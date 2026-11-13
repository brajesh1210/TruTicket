// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TruTicket
 * @notice One NFT per ticket. Resale is capped on-chain, transfers are limited, group allocation
 *         is a zero-price transfer, and redemption is single-use at the gate. Direct wallet-to-wallet
 *         transfers are refused: ownership only changes through this contract's own functions.
 *
 * Prices are in paise (minor units), the same unit as the database.
 * eventKey = keccak256 of the event UUID string, computed by the backend.
 */
contract TruTicket is ERC721, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
    bytes32 public constant MARKETPLACE_ROLE = keccak256("MARKETPLACE_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint16 public constant MIN_CAP_BPS = 10000; // 100% of face value
    uint16 public constant MAX_CAP_BPS = 20000; // 200% of face value
    uint8 public constant MAX_TRANSFER_LIMIT = 10;
    uint64 public constant LISTING_TTL = 7 days;

    struct Policy {
        uint16 capBps;
        uint8 transferLimit;
        uint64 resaleCutoff; // unix seconds; resale closes at this time
        bool set;
    }

    struct Ticket {
        bytes32 eventKey;
        uint256 faceValueMinor; // immutable after mint
        uint8 transferCount;    // resale transfers only (group allocation does not count)
        bool redeemed;
        bool revoked;
    }

    struct Listing {
        address seller;
        uint256 askMinor;
        uint64 expiresAt;
        bool active;
    }

    mapping(bytes32 => Policy) public policies;
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => Listing) public listings;

    uint256 private _nextTokenId = 1;
    bool private _ownershipMove; // true only while this contract moves a ticket itself

    event PolicySet(bytes32 indexed eventKey, uint16 capBps, uint8 transferLimit, uint64 resaleCutoff);
    event TicketMinted(uint256 indexed tokenId, bytes32 indexed eventKey, address indexed to, uint256 faceValueMinor);
    event TicketListed(uint256 indexed tokenId, address indexed seller, uint256 askMinor, uint64 expiresAt);
    event ListingCancelled(uint256 indexed tokenId, address indexed by);
    event TicketResold(uint256 indexed tokenId, address indexed from, address indexed to, uint256 priceMinor);
    event TicketAllocated(uint256 indexed tokenId, address indexed from, address indexed to);
    event TicketRedeemed(uint256 indexed tokenId, address indexed verifier);
    event TicketRevoked(uint256 indexed tokenId, string reason);

    constructor() ERC721("TruTicket", "TRT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ORGANIZER_ROLE, msg.sender);
        _grantRole(MARKETPLACE_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    // ---------- organiser ----------

    function setPolicy(bytes32 eventKey, uint16 capBps, uint8 transferLimit, uint64 resaleCutoff)
        external
        onlyRole(ORGANIZER_ROLE)
    {
        require(eventKey != bytes32(0), "Invalid event");
        require(capBps >= MIN_CAP_BPS && capBps <= MAX_CAP_BPS, "Invalid cap");
        require(transferLimit >= 1 && transferLimit <= MAX_TRANSFER_LIMIT, "Invalid transfer limit");
        policies[eventKey] = Policy({capBps: capBps, transferLimit: transferLimit, resaleCutoff: resaleCutoff, set: true});
        emit PolicySet(eventKey, capBps, transferLimit, resaleCutoff);
    }

    function mintTicket(address to, bytes32 eventKey, uint256 faceValueMinor)
        external
        onlyRole(ORGANIZER_ROLE)
        whenNotPaused
        returns (uint256 tokenId)
    {
        require(to != address(0), "Invalid recipient");
        require(faceValueMinor > 0, "Face value must be positive");
        require(policies[eventKey].set, "No policy for event");

        tokenId = _nextTokenId++;
        tickets[tokenId] = Ticket({eventKey: eventKey, faceValueMinor: faceValueMinor, transferCount: 0, redeemed: false, revoked: false});
        _mint(to, tokenId);
        emit TicketMinted(tokenId, eventKey, to, faceValueMinor);
    }

    // ---------- owner: resale listing ----------

    function listForResale(uint256 tokenId, uint256 askMinor) external whenNotPaused {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        _list(tokenId, msg.sender, askMinor);
    }

    /// Backend lists on behalf of the on-chain owner. Users hold custodial wallets and do not sign.
    function listForResaleFor(uint256 tokenId, uint256 askMinor) external onlyRole(MARKETPLACE_ROLE) whenNotPaused {
        _list(tokenId, ownerOf(tokenId), askMinor);
    }

    function _list(uint256 tokenId, address seller, uint256 askMinor) private {
        Ticket storage t = tickets[tokenId];
        require(!t.redeemed && !t.revoked, "Ticket not usable");
        require(!listings[tokenId].active, "Already listed");

        Policy storage p = policies[t.eventKey];
        require(p.set, "No policy for event");
        require(block.timestamp < p.resaleCutoff, "Resale cutoff passed");
        require(t.transferCount < p.transferLimit, "Transfer limit reached");
        require(askMinor > 0 && askMinor <= maxResalePrice(tokenId), "Price exceeds cap");

        uint64 expiresAt = uint64(block.timestamp) + LISTING_TTL;
        listings[tokenId] = Listing({seller: seller, askMinor: askMinor, expiresAt: expiresAt, active: true});
        emit TicketListed(tokenId, seller, askMinor, expiresAt);
    }

    function cancelListing(uint256 tokenId) external {
        Listing storage l = listings[tokenId];
        require(l.active, "No active listing");
        require(l.seller == msg.sender || hasRole(MARKETPLACE_ROLE, msg.sender), "Not authorized");
        l.active = false;
        emit ListingCancelled(tokenId, msg.sender);
    }

    // ---------- marketplace: settle a resale (the backend calls this after payment is captured) ----------

    function settleResale(uint256 tokenId, address buyer)
        external
        onlyRole(MARKETPLACE_ROLE)
        whenNotPaused
        nonReentrant
    {
        Listing storage l = listings[tokenId];
        require(l.active, "No active listing");
        require(block.timestamp < l.expiresAt, "Listing expired");
        require(buyer != address(0) && buyer != l.seller, "Invalid buyer");

        Ticket storage t = tickets[tokenId];
        require(!t.redeemed && !t.revoked, "Ticket not usable");
        Policy storage p = policies[t.eventKey];
        require(block.timestamp < p.resaleCutoff, "Resale cutoff passed");
        require(t.transferCount < p.transferLimit, "Transfer limit reached");
        require(l.askMinor <= maxResalePrice(tokenId), "Price exceeds cap");

        address seller = l.seller;
        uint256 price = l.askMinor;
        l.active = false;
        t.transferCount += 1;

        _move(seller, buyer, tokenId);
        emit TicketResold(tokenId, seller, buyer, price);
    }

    // ---------- marketplace: group allocation (zero price, does not count as a resale) ----------

    function allocate(uint256 tokenId, address member)
        external
        onlyRole(MARKETPLACE_ROLE)
        whenNotPaused
        nonReentrant
    {
        require(member != address(0), "Invalid member");
        Ticket storage t = tickets[tokenId];
        require(!t.redeemed && !t.revoked, "Ticket not usable");
        require(!listings[tokenId].active, "Ticket listed");

        address from = ownerOf(tokenId);
        require(member != from, "Already owner");
        _move(from, member, tokenId);
        emit TicketAllocated(tokenId, from, member);
    }

    // ---------- verifier: gate ----------

    function redeem(uint256 tokenId) external onlyRole(VERIFIER_ROLE) whenNotPaused nonReentrant {
        Ticket storage t = tickets[tokenId];
        require(!t.revoked, "Ticket revoked");
        require(!t.redeemed, "Already redeemed");
        require(!listings[tokenId].active, "Ticket listed");
        require(ownerOf(tokenId) != address(0), "Unknown ticket");

        t.redeemed = true;
        emit TicketRedeemed(tokenId, msg.sender);
    }

    // ---------- admin ----------

    function revoke(uint256 tokenId, string calldata reason) external onlyRole(ADMIN_ROLE) {
        Ticket storage t = tickets[tokenId];
        require(!t.redeemed, "Already redeemed");
        require(!t.revoked, "Already revoked");
        t.revoked = true;
        listings[tokenId].active = false;
        emit TicketRevoked(tokenId, reason);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ---------- views ----------

    function maxResalePrice(uint256 tokenId) public view returns (uint256) {
        Ticket storage t = tickets[tokenId];
        Policy storage p = policies[t.eventKey];
        return (t.faceValueMinor * p.capBps) / 10000;
    }

    function canTransfer(uint256 tokenId) public view returns (bool) {
        Ticket storage t = tickets[tokenId];
        return !t.redeemed && !t.revoked && !listings[tokenId].active;
    }

    // ---------- internals ----------

    function _move(address from, address to, uint256 tokenId) private {
        _ownershipMove = true;
        _transfer(from, to, tokenId);
        _ownershipMove = false;
    }

    /// Only mint (from == 0) and moves made by this contract are allowed. Burn is never allowed.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) {
            require(_ownershipMove, "Direct transfer not allowed");
            require(to != address(0), "Burn not allowed");
            // A listed ticket cannot move unless the marketplace settles it (settleResale clears the listing first).
        }
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
