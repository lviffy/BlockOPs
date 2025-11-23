// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract PaymentEscrow is Ownable, ReentrancyGuard, Pausable {
    
    struct Payment {
        address user;
        uint256 amount;
        address token;
        string agentId;
        string toolName;
        uint256 timestamp;
        bool executed;
        bool refunded;
    }
    
    mapping(bytes32 => Payment) public payments;
    mapping(address => bool) public authorizedBackends;
    mapping(address => bool) public supportedTokens;
    address public treasury;
    
    event PaymentCreated(bytes32 indexed paymentId, address indexed user, uint256 amount, string toolName);
    event PaymentExecuted(bytes32 indexed paymentId, address indexed backend);
    event PaymentRefunded(bytes32 indexed paymentId, address indexed user, uint256 amount);
    event TokenSupported(address indexed token, bool supported);
    
    constructor(address _treasury, address initialOwner) Ownable(initialOwner) {
        require(_treasury != address(0), "Invalid treasury address");
        treasury = _treasury;
    }
    
    function createPayment(
        string memory agentId,
        string memory toolName,
        address token,
        uint256 amount
    ) external payable nonReentrant whenNotPaused returns (bytes32) {
        bytes32 paymentId = keccak256(
            abi.encodePacked(msg.sender, agentId, toolName, block.timestamp, block.number)
        );
        
        require(payments[paymentId].timestamp == 0, "Payment already exists");
        
        if (token == address(0)) {
            require(msg.value == amount, "Incorrect payment amount");
        } else {
            require(supportedTokens[token], "Token not supported");
            require(
                IERC20(token).transferFrom(msg.sender, address(this), amount),
                "Token transfer failed"
            );
        }
        
        payments[paymentId] = Payment({
            user: msg.sender,
            amount: amount,
            token: token,
            agentId: agentId,
            toolName: toolName,
            timestamp: block.timestamp,
            executed: false,
            refunded: false
        });
        
        emit PaymentCreated(paymentId, msg.sender, amount, toolName);
        return paymentId;
    }
    
    function executePayment(bytes32 paymentId) external nonReentrant {
        require(authorizedBackends[msg.sender], "Not authorized");
        Payment storage payment = payments[paymentId];
        require(payment.timestamp > 0, "Payment not found");
        require(!payment.executed, "Already executed");
        require(!payment.refunded, "Already refunded");
        
        payment.executed = true;
        
        if (payment.token == address(0)) {
            (bool success, ) = treasury.call{value: payment.amount}("");
            require(success, "Transfer failed");
        } else {
            require(
                IERC20(payment.token).transfer(treasury, payment.amount),
                "Token transfer failed"
            );
        }
        
        emit PaymentExecuted(paymentId, msg.sender);
    }
    
    function refundPayment(bytes32 paymentId) external nonReentrant {
        require(authorizedBackends[msg.sender], "Not authorized");
        Payment storage payment = payments[paymentId];
        require(payment.timestamp > 0, "Payment not found");
        require(!payment.executed, "Already executed");
        require(!payment.refunded, "Already refunded");
        
        payment.refunded = true;
        
        if (payment.token == address(0)) {
            (bool success, ) = payment.user.call{value: payment.amount}("");
            require(success, "Refund failed");
        } else {
            require(
                IERC20(payment.token).transfer(payment.user, payment.amount),
                "Token refund failed"
            );
        }
        
        emit PaymentRefunded(paymentId, payment.user, payment.amount);
    }
    
    function addAuthorizedBackend(address backend) external onlyOwner {
        authorizedBackends[backend] = true;
    }
    
    function removeAuthorizedBackend(address backend) external onlyOwner {
        authorizedBackends[backend] = false;
    }
    
    function setSupportedToken(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }
    
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function verifyPayment(bytes32 paymentId) external view returns (bool) {
        Payment memory payment = payments[paymentId];
        return payment.timestamp > 0 && !payment.executed && !payment.refunded;
    }
    
    function getPayment(bytes32 paymentId) external view returns (Payment memory) {
        return payments[paymentId];
    }
}
