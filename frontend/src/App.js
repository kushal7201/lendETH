import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import { CONTRACT_ADDRESS, CHAIN_ID } from './config';
import LendingContractArtifact from './contracts/contracts/LendingContract.sol/LendingContract.json';

function App() {
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [collateralAmount, setCollateralAmount] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loanDetails, setLoanDetails] = useState(null);
  const [requiredRepayment, setRequiredRepayment] = useState(null);
  const [currentInterest, setCurrentInterest] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lenderBalance, setLenderBalance] = useState('0');
  const [lenderInterest, setLenderInterest] = useState('0');
  const [lendAmount, setLendAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [totalPoolFunds, setTotalPoolFunds] = useState('0');

  const updateRepaymentAmount = React.useCallback(async () => {
    if (contract && account && loanDetails?.active) {
      try {
        // Get current JS timestamp in seconds
        const currentTime = Math.floor(Date.now() / 1000);
        
        // Calculate elapsed time
        const timeElapsed = currentTime - loanDetails.timestamp;
        setElapsedTime(timeElapsed);
        
        // Get repayment amount using the custom timestamp function
        const repaymentAmount = await contract.getRequiredRepaymentAmountWithTimestamp(account, currentTime);
        
        // Get current interest amount for debugging
        const interest = await contract.getCurrentInterest(account);
        setCurrentInterest(interest);
        
        console.log(`JS timestamp: ${currentTime}, Loan timestamp: ${loanDetails.timestamp}`);
        console.log(`Time elapsed: ${timeElapsed}s, Interest: ${ethers.formatEther(interest)} ETH`);
        console.log(`Repayment amount: ${ethers.formatEther(repaymentAmount)} ETH (${repaymentAmount.toString()} wei)`);
        
        setRequiredRepayment(repaymentAmount);
      } catch (error) {
        console.error('Error updating repayment amount:', error);
      }
    }
  }, [contract, account, loanDetails]);

  // First useEffect for initialization
  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        try {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setAccount(address);

          const network = await provider.getNetwork();
          if (network.chainId.toString() !== CHAIN_ID) {
            const error = 'Please connect to the Hardhat local network';
            setError(error);
            alert(error);
            return;
          }

          const contract = new ethers.Contract(
            CONTRACT_ADDRESS,
            LendingContractArtifact.abi,
            signer
          );
          setContract(contract);
          console.log('Contract initialized:', contract);

          await loadLoanDetails(contract, address);
          
          // Listen for account changes
          window.ethereum.on('accountsChanged', (accounts) => {
            setAccount(accounts[0]);
            loadLoanDetails(contract, accounts[0]);
          });
        } catch (error) {
          console.error("Error initializing the dApp:", error);
          setError(error.message);
        }
      } else {
        const error = "Please install MetaMask!";
        console.log(error);
        setError(error);
      }
    };

    init();
  }, []);

  // Separate useEffect for real-time updates
  useEffect(() => {
    let intervalId;

    if (contract && account && loanDetails?.active) {
      // Initial update
      updateRepaymentAmount();
      // Update every second
      intervalId = setInterval(updateRepaymentAmount, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [contract, account, loanDetails?.active, updateRepaymentAmount]);

  const loadLenderDetails = async (contract, address) => {
    try {
      const balance = await contract.lenderBalance(address);
      const interest = await contract.getLenderInterest(address);
      setLenderBalance(ethers.formatEther(balance));
      setLenderInterest(ethers.formatEther(interest));
    } catch (error) {
      console.error("Error loading lender details:", error);
    }
  };

  const loadTotalPoolFunds = async (contract) => {
    try {
      const total = await contract.totalPoolFunds();
      setTotalPoolFunds(ethers.formatEther(total));
    } catch (error) {
      console.error("Error loading total pool funds:", error);
    }
  };

  const loadLoanDetails = async (contract, address) => {
    try {
      console.log('Loading loan details for address:', address);
      const details = await contract.getLoanDetails(address);
      console.log('Loan details received:', details);
      
      const loanInfo = {
        collateralAmount: details[0] ? ethers.formatEther(details[0]) : '0',
        loanAmount: details[1] ? ethers.formatEther(details[1]) : '0',
        timestamp: details[2] ? Number(details[2]) : 0,
        active: details[3] || false
      };
      setLoanDetails(loanInfo);

      // If loan is active, immediately get the repayment amount
      if (loanInfo.active && details[1] > 0) {
        const currentTime = Math.floor(Date.now() / 1000);
        const repaymentAmount = await contract.getRequiredRepaymentAmountWithTimestamp(address, currentTime);
        setRequiredRepayment(repaymentAmount);
        
        const interest = await contract.getCurrentInterest(address);
        setCurrentInterest(interest);
        
        setElapsedTime(currentTime - loanInfo.timestamp);
      } else {
        setRequiredRepayment(null);
        setCurrentInterest(null);
        setElapsedTime(0);
      }

      await loadLenderDetails(contract, address);
      await loadTotalPoolFunds(contract);
    } catch (error) {
      console.error("Error loading loan details:", error);
      setError(error.message);
      setLoanDetails({
        collateralAmount: '0',
        loanAmount: '0',
        timestamp: 0,
        active: false
      });
      setRequiredRepayment(null);
      setLenderBalance('0');
      setLenderInterest('0');
      setTotalPoolFunds('0');
    }
  };

  const depositCollateral = async (e) => {
    e.preventDefault();
    if (!contract || !collateralAmount) {
      console.log('Missing contract or collateral amount');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      console.log('Depositing collateral:', collateralAmount, 'ETH');
      
      const tx = await contract.depositCollateral({
        value: ethers.parseEther(collateralAmount.toString())
      });
      console.log('Transaction sent:', tx);
      
      console.log('Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);
      
      await loadLoanDetails(contract, account);
      setCollateralAmount('');
    } catch (error) {
      console.error("Error depositing collateral:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const borrowLoan = async (e) => {
    e.preventDefault();
    if (!contract || !loanAmount) {
      console.log('Missing contract or loan amount');
      return;
    }

    try {
      setLoading(true);
      setError('');
      console.log('Borrowing loan:', loanAmount, 'ETH');
      
      const tx = await contract.borrow(ethers.parseEther(loanAmount.toString()));
      console.log('Transaction sent:', tx);
      
      console.log('Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);
      
      await loadLoanDetails(contract, account);
      setLoanAmount('');
    } catch (error) {
      console.error("Error borrowing loan:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const repayLoan = async () => {
    if (!contract || !loanDetails || !requiredRepayment) {
      console.log('Missing contract, loan details, or repayment amount');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Get the latest repayment amount
      const currentTime = Math.floor(Date.now() / 1000);
      const latestRepaymentAmount = await contract.getRequiredRepaymentAmountWithTimestamp(account, currentTime);
      console.log('Repayment amount:', ethers.formatEther(latestRepaymentAmount), 'ETH');
      
      // Check user's balance
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(account);
      console.log('User balance:', ethers.formatEther(balance), 'ETH');
      
      if (balance < latestRepaymentAmount) {
        throw new Error(`Insufficient balance. You need ${ethers.formatEther(latestRepaymentAmount)} ETH to repay the loan`);
      }

      // Estimate gas first
      const gasEstimate = await provider.estimateGas({
        to: contract.target,
        from: account,
        value: latestRepaymentAmount,
        data: contract.interface.encodeFunctionData("repayLoan", [])
      });

      // Add 20% buffer to gas estimate
      const gasLimit = gasEstimate * BigInt(12) / BigInt(10);

      console.log('Estimated gas:', gasEstimate.toString());
      console.log('Using gas limit:', gasLimit.toString());

      // Create and send the transaction
      const tx = await contract.repayLoan({
        value: latestRepaymentAmount,
        gasLimit: gasLimit
      });
      
      console.log('Transaction sent:', tx.hash);
      
      console.log('Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);
      
      await loadLoanDetails(contract, account);
      setRequiredRepayment(null);
      setCurrentInterest(null);
      setElapsedTime(0);
    } catch (error) {
      console.error("Error repaying loan:", error);
      
      // Improved error handling for better user feedback
      let errorMessage = error.message;
      if (error.code === 'CALL_EXCEPTION') {
        errorMessage = 'Transaction failed. This could be due to insufficient gas or contract requirements not being met.';
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = 'You don\'t have enough ETH to pay for this transaction and gas fees';
      } else if (error.data) {
        errorMessage = `Contract error: ${error.data.message || error.data}`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const withdrawCollateral = async () => {
    if (!contract || !loanDetails) {
      console.log('Missing contract or loan details');
      return;
    }

    try {
      setLoading(true);
      setError('');
      console.log('Withdrawing collateral...');
      
      const tx = await contract.withdrawCollateral();
      console.log('Transaction sent:', tx);
      
      console.log('Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);
      
      await loadLoanDetails(contract, account);
    } catch (error) {
      console.error("Error withdrawing collateral:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const provideLiquidity = async (e) => {
    e.preventDefault();
    if (!contract || !lendAmount) {
      console.log('Missing contract or lend amount');
      return;
    }

    try {
      setLoading(true);
      setError('');
      console.log('Providing liquidity:', lendAmount, 'ETH');
      
      const tx = await contract.provideLiquidity({
        value: ethers.parseEther(lendAmount.toString())
      });
      console.log('Transaction sent:', tx);
      
      console.log('Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);
      
      await loadLenderDetails(contract, account);
      setLendAmount('');
    } catch (error) {
      console.error("Error providing liquidity:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const withdrawLiquidity = async (e) => {
    e.preventDefault();
    if (!contract || !withdrawAmount) {
      console.log('Missing contract or withdraw amount');
      return;
    }

    try {
      setLoading(true);
      setError('');
      console.log('Withdrawing liquidity:', withdrawAmount, 'ETH');
      
      const tx = await contract.withdrawLiquidity(ethers.parseEther(withdrawAmount.toString()));
      console.log('Transaction sent:', tx);
      
      console.log('Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);
      
      await loadLenderDetails(contract, account);
      setWithdrawAmount('');
    } catch (error) {
      console.error("Error withdrawing liquidity:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>LendETH: Lending Platform</h1>
        <p>Connected Account: {account}</p>
        <p className="total-pool">Total Pool Funds: {totalPoolFunds} ETH</p>
        
        {error && (
          <div className="error-message">
            Error: {error}
          </div>
        )}

        <div className="lender-details">
          <h2>Lender Dashboard</h2>
          <p>Your Balance in Pool: {lenderBalance} ETH</p>
          <p>Earned Interest: {lenderInterest} ETH</p>
          
          <form onSubmit={provideLiquidity}>
            <input
              type="number"
              step="0.000000000000000001"
              value={lendAmount}
              onChange={(e) => setLendAmount(e.target.value)}
              placeholder="Amount to Lend (ETH)"
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Provide Liquidity'}
            </button>
          </form>

          <form onSubmit={withdrawLiquidity}>
            <input
              type="number"
              step="0.000000000000000001"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount to Withdraw (ETH)"
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Withdraw Liquidity'}
            </button>
          </form>
        </div>

        {loanDetails && (
          <div className="loan-details">
            <h2>Borrower Dashboard</h2>
            <p>Collateral: {loanDetails.collateralAmount} ETH</p>
            <p>Loan Amount: {loanDetails.loanAmount} ETH</p>
            <p>Status: {loanDetails.active ? 'Active🟢' : 'Inactive'}</p>
            {requiredRepayment && loanDetails.active && (
              <div className="repayment-amount">
                <p>Required Repayment Amount: {ethers.formatEther(requiredRepayment)} ETH</p>
                {/* <p className="repayment-wei">
                  <small>({requiredRepayment.toString()} wei)</small>
                </p> */}
                {/* {currentInterest && (
                  <p className="interest-only">
                    <small>
                      Current Interest: {ethers.formatEther(currentInterest)} ETH ({currentInterest.toString()} wei)
                    </small>
                  </p>
                )} */}
                {loanDetails.timestamp && (
                  <p className="loan-duration">
                    <small>
                      Loan Duration: {elapsedTime} seconds
                    </small>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="actions">
          <form onSubmit={depositCollateral}>
            <input
              type="number"
              step="0.000000000000000001"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              placeholder="Collateral Amount (ETH)"
              disabled={loading || (loanDetails && loanDetails.active)}
            />
            <button type="submit" disabled={loading || (loanDetails && loanDetails.active)}>
              {loading ? 'Processing...' : 'Deposit Collateral'}
            </button>
          </form>

          <form onSubmit={borrowLoan}>
            <input
              type="number"
              step="0.000000000000000001"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
              placeholder="Loan Amount (ETH)"
              disabled={loading || !loanDetails || loanDetails.active}
            />
            <button type="submit" disabled={loading || !loanDetails || loanDetails.active}>
              {loading ? 'Processing...' : 'Borrow'}
            </button>
          </form>

          {loanDetails?.active && (
            <button 
              onClick={repayLoan} 
              disabled={loading || !requiredRepayment}
              className="repay-button"
            >
              {loading ? 'Processing...' : `Repay Loan (${
                requiredRepayment ? ethers.formatEther(requiredRepayment) : '0'
              } ETH)`}
            </button>
          )}

          {loanDetails && !loanDetails.active && Number(loanDetails.collateralAmount) > 0 && (
            <button
              onClick={withdrawCollateral}
              disabled={loading}
              className="withdraw-button"
            >
              {loading ? 'Processing...' : 'Withdraw Collateral'}
            </button>
          )}
        </div>
      </header>
    </div>
  );
}

export default App;
