// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract LendingContract is ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public totalPoolFunds;
    mapping(address => uint256) public lenderBalance;
    mapping(address => uint256) public lenderInterestEarned;
    address[] public lenders;
    
    struct Loan {
        uint256 collateralAmount;
        uint256 loanAmount;
        uint256 timestamp;
        bool active;
    }

    mapping(address => Loan) public loans;
    uint256 public interestRate;
    uint256 public liquidationThreshold;
    uint256 public constant SECONDS_IN_YEAR = 31536000;
    uint256 public constant INTEREST_DECIMALS = 18;
    uint256 public constant BUFFER_TIME = 60;

    event CollateralDeposited(address borrower, uint256 amount);
    event CollateralWithdrawn(address borrower, uint256 amount);
    event LoanTaken(address borrower, uint256 amount);
    event LoanRepaid(address borrower, uint256 amount, uint256 interest);
    event Liquidated(address borrower, uint256 collateralAmount);
    event LiquidityProvided(address lender, uint256 amount);
    event LiquidityWithdrawn(address lender, uint256 amount);
    event InterestDistributed(address lender, uint256 amount);

    constructor(uint256 _interestRate, uint256 _liquidationThreshold) {
        interestRate = _interestRate;
        liquidationThreshold = _liquidationThreshold;
        totalPoolFunds = 0;
    }

    // Function for lenders to provide liquidity
    function provideLiquidity() external payable nonReentrant {
        require(msg.value > 0, "Must provide some ETH");
        
        if(lenderBalance[msg.sender] == 0) {
            lenders.push(msg.sender);
        }
        
        lenderBalance[msg.sender] = lenderBalance[msg.sender].add(msg.value);
        totalPoolFunds = totalPoolFunds.add(msg.value);
        
        emit LiquidityProvided(msg.sender, msg.value);
    }

    // Function for lenders to withdraw their funds and earned interest
    function withdrawLiquidity(uint256 amount) external nonReentrant {
        // require(lenderBalance[msg.sender] >= amount, "Insufficient balance");
        require(totalPoolFunds >= amount, "Insufficient pool funds");
        
        uint256 interestEarned = lenderInterestEarned[msg.sender];
        uint256 totalWithdraw = amount.add(interestEarned);
        
        lenderBalance[msg.sender] = lenderBalance[msg.sender].sub(amount);
        lenderInterestEarned[msg.sender] = 0;
        totalPoolFunds = totalPoolFunds.sub(amount);
        
        payable(msg.sender).transfer(totalWithdraw);
        emit LiquidityWithdrawn(msg.sender, totalWithdraw);
    }

    // Internal function to distribute interest among lenders
    function _distributeInterest(uint256 interestAmount) internal {
        uint256 totalDistributed = 0;
        
        for(uint i = 0; i < lenders.length; i++) {
            address currentLender = lenders[i];
            if(lenderBalance[currentLender] > 0) {
                uint256 share = interestAmount.mul(lenderBalance[currentLender]).div(totalPoolFunds);
                lenderInterestEarned[currentLender] = lenderInterestEarned[currentLender].add(share);
                totalDistributed = totalDistributed.add(share);
                emit InterestDistributed(currentLender, share);
            }
        }
    }

    function depositCollateral() external payable nonReentrant {
        require(msg.value > 0, "Must deposit some ETH as collateral");
        require(!loans[msg.sender].active, "Already has an active loan");

        // Clear any previous loan data
        delete loans[msg.sender];
        
        loans[msg.sender] = Loan({
            collateralAmount: msg.value,
            loanAmount: 0,
            timestamp: block.timestamp,
            active: false
        });

        emit CollateralDeposited(msg.sender, msg.value);
    }

    function withdrawCollateral() external nonReentrant {
        Loan storage loan = loans[msg.sender];
        require(loan.collateralAmount > 0, "No collateral to withdraw");
        require(!loan.active, "Cannot withdraw while loan is active");

        uint256 amountToWithdraw = loan.collateralAmount;
        delete loans[msg.sender];
        
        payable(msg.sender).transfer(amountToWithdraw);
        emit CollateralWithdrawn(msg.sender, amountToWithdraw);
    }

    function borrow(uint256 amount) external nonReentrant {
        Loan storage loan = loans[msg.sender];
        require(loan.collateralAmount > 0, "No collateral deposited");
        require(!loan.active, "Loan already active");
        require(amount <= loan.collateralAmount.mul(liquidationThreshold).div(100), 
            "Cannot borrow more than collateral threshold");
        require(totalPoolFunds >= amount, "Insufficient funds in lending pool");

        loan.loanAmount = amount;
        loan.timestamp = block.timestamp;
        loan.active = true;

        totalPoolFunds = totalPoolFunds.sub(amount);
        payable(msg.sender).transfer(amount);
        emit LoanTaken(msg.sender, amount);
    }

    function calculateInterest(uint256 principal, uint256 timeElapsed) public view returns (uint256) {
        if (timeElapsed == 0 || principal == 0) return 0;
        
        // First calculate the year fraction with standard precision
        uint256 yearFraction = timeElapsed.mul(10 ** INTEREST_DECIMALS).div(SECONDS_IN_YEAR);
        
        // Convert interest rate to a decimal with standard precision (10% = 0.1)
        uint256 rateDecimal = interestRate.mul(10 ** INTEREST_DECIMALS).div(10000);
        
        // Calculate interest amount piece by piece to avoid overflow
        uint256 interestPerYear = principal.mul(rateDecimal).div(10 ** INTEREST_DECIMALS);
        uint256 interest = interestPerYear.mul(yearFraction).div(10 ** INTEREST_DECIMALS);
        
        // Add 1 wei to account for any rounding down
        if (interest > 0) {
            interest = interest.add(1);
        }
        
        return interest;
    }

    function getRequiredRepaymentAmount(address borrower) public view returns (uint256) {
        Loan storage loan = loans[borrower];
        require(loan.active, "No active loan found");
        
        uint256 timeElapsed = block.timestamp.sub(loan.timestamp);
        uint256 interest = calculateInterest(loan.loanAmount, timeElapsed);
        uint256 baseAmount = loan.loanAmount.add(interest);
        
        // Calculate a small buffer based on one minute of additional interest
        uint256 buffer = calculateInterest(loan.loanAmount, BUFFER_TIME);
        
        return baseAmount.add(buffer);
    }
    
    // Add function to calculate repayment with custom timestamp for testing
    function getRequiredRepaymentAmountWithTimestamp(address borrower, uint256 customTimestamp) public view returns (uint256) {
        Loan storage loan = loans[borrower];
        require(loan.active, "No active loan found");
        
        uint256 timeElapsed = customTimestamp.sub(loan.timestamp);
        uint256 interest = calculateInterest(loan.loanAmount, timeElapsed);
        uint256 baseAmount = loan.loanAmount.add(interest);
        
        // Calculate a small buffer based on one minute of additional interest
        uint256 buffer = calculateInterest(loan.loanAmount, BUFFER_TIME);
        
        return baseAmount.add(buffer);
    }
    
    function getCurrentInterest(address borrower) public view returns (uint256) {
        Loan storage loan = loans[borrower];
        require(loan.active, "No active loan found");
        
        uint256 timeElapsed = block.timestamp.sub(loan.timestamp);
        return calculateInterest(loan.loanAmount, timeElapsed);
    }

    function repayLoan() external payable nonReentrant {
        Loan storage loan = loans[msg.sender];
        require(loan.active, "No active loan found for this address");
        require(loan.loanAmount > 0, "Invalid loan amount");
        
        uint256 timeElapsed = block.timestamp.sub(loan.timestamp);
        uint256 interest = calculateInterest(loan.loanAmount, timeElapsed);
        uint256 totalDue = loan.loanAmount.add(interest);
        
        require(msg.value > 0, "Must send ETH to repay loan");
        require(msg.value >= totalDue, "Insufficient payment amount");

        // Save values before deleting loan
        uint256 collateralToReturn = loan.collateralAmount;
        uint256 loanAmountForEvent = loan.loanAmount;
        uint256 interestForEvent = interest;
        uint256 principalAmount = loan.loanAmount;
        
        // Clear loan data first to prevent reentrancy
        delete loans[msg.sender];
        
        // Calculate excess payment to return
        uint256 excess = 0;
        if (msg.value > totalDue) {
            excess = msg.value.sub(totalDue);
        }

        // First add principal back to total pool funds
        totalPoolFunds = totalPoolFunds.add(principalAmount);
        
        // Then add interest to total pool funds before distribution
        totalPoolFunds = totalPoolFunds.add(interest);
        
        // Distribute interest among lenders
        _distributeInterest(interest);

        // Return collateral and excess in a single transfer
        uint256 totalReturn = collateralToReturn.add(excess);
        if (totalReturn > 0) {
            payable(msg.sender).transfer(totalReturn);
        }

        emit LoanRepaid(msg.sender, loanAmountForEvent, interestForEvent);
    }

    // Helper function to convert uint to string
    function uint2str(uint256 _i) internal pure returns (string memory str) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        j = _i;
        while (j != 0) {
            bstr[--k] = bytes1(uint8(48 + j % 10));
            j /= 10;
        }
        str = string(bstr);
    }

    function liquidate(address borrower) external nonReentrant {
        Loan storage loan = loans[borrower];
        require(loan.active, "No active loan");
        
        uint256 timeElapsed = block.timestamp.sub(loan.timestamp);
        uint256 interest = calculateInterest(loan.loanAmount, timeElapsed);
        uint256 totalDue = loan.loanAmount.add(interest);
        
        require(totalDue >= loan.collateralAmount.mul(liquidationThreshold).div(100), 
                "Loan not eligible for liquidation");

        uint256 collateralToLiquidate = loan.collateralAmount;
        delete loans[borrower];
        
        // Add liquidated collateral to the pool
        totalPoolFunds = totalPoolFunds.add(collateralToLiquidate);
        emit Liquidated(borrower, collateralToLiquidate);
    }

    function getLoanDetails(address borrower) external view returns (
        uint256 collateralAmount,
        uint256 loanAmount,
        uint256 timestamp,
        bool active
    ) {
        Loan storage loan = loans[borrower];
        return (
            loan.collateralAmount,
            loan.loanAmount,
            loan.timestamp,
            loan.active
        );
    }

    // Add function to view lender's earned interest
    function getLenderInterest(address _lender) external view returns (uint256) {
        return lenderInterestEarned[_lender];
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
