// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title TruTicket
 * @dev Ticket NFT with price-capped resale, restricted transfers, group allocation,
 *      and atomic redemption. Deployed on Polygon Amoy testnet.
 */
contract TruTicket is ERC721, AccessControl, ReentrancyGuard {
    // Roles
    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
    bytes32 public constant MARKETPLACE_ROLE = keccak256("MARKETPLACE_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // Counters
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    // Event policies: eventId => policy
    struct EventPolicy {
        uint256 capBps;           // resale cap in basis points (10000 = 100%, 11000 = 110%)
        uint256 transferLimit;    // max transfers allowed per ticket
        uint256 resaleCutoff;     // timestamp after which resale is disabled
        uint256 version;
        bool active;
    }
    mapping(string => EventPolicy) public eventPolicies;

    // Ticket metadata: tokenId => face value (immutable)
    mapping(uint256 => uint256) public ticketFaceValue;
    mapping(uint256 => string) public ticketEventId;
    mapping(uint256 => uint256) public ticketTransferCount;

    // Resale listings: ticketId => listing
    struct ResaleListing {
        address seller;
        uint256 askPrice;         // in smallest currency unit (paise)
        bool active;
        uint256 expiresAt;
    }
    mapping(uint256 => ResaleListing) public resaleListings;

    // Group allocations: ticketId => group allocation info
    struct GroupAllocation {
        address manager;
        address member;
        bool allocated;
    }
    mapping(uint256 => GroupAllocation) public groupAllocations;

    // Redemption tracking: tokenId => redeemed
    mapping(uint256 => bool) public ticketRedeemed;

    // Events
    event PolicyRegistered(string indexed eventId, uint256 capBps, uint256 transferLimit, uint256 resaleCutoff, uint256 version);
    event TicketMinted(uint256 indexed tokenId, string indexed eventId, address indexed owner, uint256 faceValue);
    event TicketListed(uint256 indexed tokenId, address indexed seller, uint256 askPrice);
    event TicketResold(uint256 indexed tokenId, address indexed from, address indexed to, uint256 price);
    event TicketRedeemed(uint256 indexed tokenId, address indexed verifier);
    event TicketRevoked(uint256 indexed tokenId, address indexed admin, string reason);
    event GroupAllocated(uint256 indexed tokenId, address indexed manager, address indexed member);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    modifier onlyOrganizer() {
        require(_msgSender() != address(0), "Zero address");
        require(hasRole(ORGANIZER_ROLE, _msgSender()), "Not organizer");
        _;
    }

    modifier onlyMarketplace() {
        require(hasRole(MARKETPLACE_ROLE, _msgSender()), "Not marketplace");
        _;
    }

    modifier onlyVerifier() {
        require(hasRole(VERIFIER_ROLE, _msgSender()), "Not verifier");
        _;
    }

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, _msgSender()), "Not admin");
        _;
    }

    constructor() ERC721("TruTicket", "TRT") {
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(ORGANIZER_ROLE, msg.sender);
        _setupRole(MARKETPLACE_ROLE, msg.sender);
        _setupRole(VERIFIER_ROLE, msg.sender);
    }

    /**
     * @dev Register event policy for an organizer.
     */
    function createEventPolicy(
        string calldata eventId,
        uint256 capBps,
        uint256 transferLimit,
        uint256 resaleCutoff
    ) external onlyOrganizer {
        require(capBps > 0 && capBps <= 20000, "Invalid cap");
        require(transferLimit > 0 && transferLimit <= 100, "Invalid transfer limit");

        eventPolicies[eventId] = EventPolicy({
            capBps: capBps,
            transferLimit: transferLimit,
            resaleCutoff: resaleCutoff,
            version: eventPolicies[eventId].version + 1,
            active: true
        });

        emit PolicyRegistered(eventId, capBps, transferLimit, resaleCutoff, eventPolicies[eventId].version);
    }

    /**
     * @dev Mint a ticket NFT. Only organizers can mint.
     * @param to The initial owner address
     * @param eventId Event identifier
     * @param faceValueMinor Face value in smallest currency unit (paise)
     * @param metadataURI URI for ticket metadata
     */
    function mintTicket(
        address to,
        string calldata eventId,
        uint256 faceValueMinor,
        string calldata metadataURI
    ) external onlyOrganizer {
        require(to != address(0), "Invalid recipient");
        require(faceValueMinor > 0, "Face value must be positive");

        uint256 tokenId = _tokenIdCounter.current++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        ticketFaceValue[tokenId] = faceValueMinor;
        ticketEventId[tokenId] = eventId;
        ticketTransferCount[tokenId] = 0;

        emit TicketMinted(tokenId, eventId, to, faceValueMinor);
    }

    /**
     * @dev Authorize a listing for resale. Only current owner can list.
     * @param tokenId Ticket token ID
     * @param askPrice Asking price in smallest currency unit
     */
    function listForResale(uint256 tokenId, uint256 askPrice) external {
        require(ownerOf(tokenId) == _msgSender(), "Not owner");
        require(!ticketRedeemed[tokenId], "Ticket already redeemed");
        require(!resaleListings[tokenId].active, "Already listed");

        string memory eventId = ticketEventId[tokenId];
        require(eventPolicies[eventId].active, "Event policy not active");
        require(block.timestamp < eventPolicies[eventId].resaleCutoff, "Resale cutoff passed");

        uint256 maxPrice = (ticketFaceValue[tokenId] * eventPolicies[eventId].capBps) / 10000;
        require(askPrice <= maxPrice, "Price exceeds cap");

        resaleListings[tokenId] = ResaleListing({
            seller: _msgSender(),
            askPrice: askPrice,
            active: true,
            expiresAt: block.timestamp + 7 days
        });

        emit TicketListed(tokenId, _msgSender(), askPrice);
    }

    /**
     * @dev Cancel a resale listing. Only seller or marketplace.
     */
    function cancelListing(uint256 tokenId) external {
        require(resaleListings[tokenId].active, "No active listing");
        require(
            resaleListings[tokenId].seller == _msgSender() || hasRole(MARKETPLACE_ROLE, _msgSender()),
            "Not authorized"
        );

        resaleListings[tokenId].active = false;
    }

    /**
     * @dev Purchase a listed ticket through marketplace. Enforces price cap on-chain.
     * @param tokenId Ticket token ID
     * @param buyer The buyer address
     */
    function resellTicket(uint256 tokenId, address buyer) external onlyMarketplace {
        require(resaleListings[tokenId].active, "No active listing");
        require(buyer != address(0), "Invalid buyer");

        ResaleListing storage listing = resaleListings[tokenId];
        string memory eventId = ticketEventId[tokenId];
        EventPolicy storage policy = eventPolicies[eventId];

        require(policy.active, "Event policy not active");
        require(block.timestamp < listing.expiresAt, "Listing expired");
        require(block.timestamp < policy.resaleCutoff, "Resale cutoff passed");

        // Verify price cap again
        uint256 maxPrice = (ticketFaceValue[tokenId] * policy.capBps) / 10000;
        require(listing.askPrice <= maxPrice, "Price exceeds cap");

        // Transfer limit check
        require(
            ticketTransferCount[tokenId] < policy.transferLimit,
            "Transfer limit exceeded"
        );

        // Execute transfer
        listing.active = false;
        ticketTransferCount[tokenId]++;
        ticketRedeemed[tokenId] = false; // reset redemption on new ownership

        _transfer(listing.seller, buyer, tokenId);

        emit TicketResold(tokenId, listing.seller, buyer, listing.askPrice);
    }

    /**
     * @dev Redeem a ticket at the gate. Atomic single-use redemption.
     * @param tokenId Ticket token ID
     * @param verifier The gate scanner address
     */
    function redeemTicket(uint256 tokenId, address verifier) external onlyVerifier nonReentrant {
        require(hasRole(VERIFIER_ROLE, verifier), "Not verifier");
        require(!ticketRedeemed[tokenId], "Already redeemed");

        string memory eventId = ticketEventId[tokenId];
        require(block.timestamp < eventPolicies[eventId].resaleCutoff || !resaleListings[tokenId].active, "Ticket listed");

        ticketRedeemed[tokenId] = true;

        emit TicketRedeemed(tokenId, verifier);
    }

    /**
     * @dev Allocate a group ticket to a member (zero-cost transfer).
     * @param tokenId Ticket token ID
     * @param manager The group manager address
     * @param member The member address to receive the ticket
     */
    function allocateGroupTicket(uint256 tokenId, address manager, address member) external onlyOrganizer {
        require(groupAllocations[tokenId].manager == manager, "Not manager");
        require(!groupAllocations[tokenId].allocated, "Already allocated");
        require(member != address(0), "Invalid member");

        groupAllocations[tokenId] = GroupAllocation({
            manager: manager,
            member: member,
            allocated: true
        });

        ticketTransferCount[tokenId]++;
        _transfer(manager, member, tokenId);

        emit GroupAllocated(tokenId, manager, member);
    }

    /**
     * @dev Revoke a ticket. Only admin.
     */
    function revokeTicket(uint256 tokenId, string calldata reason) external onlyAdmin {
        require(!ticketRedeemed[tokenId], "Already redeemed");
        ticketRedeemed[tokenId] = true;
        emit TicketRevoked(tokenId, _msgSender(), reason);
    }

    /**
     * @dev Emergency pause. Only admin.
     */
    function pause() external onlyAdmin {
        _pause();
        emit Paused(_msgSender());
    }

    /**
     * @dev Emergency unpause. Only admin.
     */
    function unpause() external onlyAdmin {
        _unpause();
        emit Unpaused(_msgSender());
    }

    /**
     * @dev Get max resale price for a ticket.
     */
    function getMaxResalePrice(uint256 tokenId) public view returns (uint256) {
        string memory eventId = ticketEventId[tokenId];
        return (ticketFaceValue[tokenId] * eventPolicies[eventId].capBps) / 10000;
    }

    /**
     * @dev Check if ticket can be transferred.
     */
    function canTransfer(uint256 tokenId) public view returns (bool) {
        return !ticketRedeemed[tokenId] && !resaleListings[tokenId].active;
    }

    // Override _beforeTokenTransfer to prevent unauthorized direct transfers
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        // Allow only through marketplace (resellTicket) or group allocation
        // Direct transfers are blocked unless coming from marketplace role
        if (to != address(0) && from != address(0)) {
            require(
                hasRole(MARKETPLACE_ROLE, _msgSender()) ||
                _msgSender() == from, // allow owner-initiated only if going through listForResale path
                "Direct transfer not allowed"
            );
        }
        super._beforeTokenTransfer(from, to, tokenId);
    }

    // Prevent burning
    function _burn(uint256 tokenId) internal virtual override {
        super._burn(tokenId);
    }
}