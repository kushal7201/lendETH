# LendETH

A decentralized lending platform built on Ethereum that enables users to borrow ETH against their collateral with a simple and secure smart contract implementation.

## Features

- **Collateral Management**: Users can deposit and withdraw ETH as collateral
- **Lending**: Borrow ETH against deposited collateral
- **Dynamic Interest Calculation**: Interest rates calculated based on loan duration
- **Real-time Updates**: View loan details and repayment amounts updating in real-time
- **Liquidation Protection**: Automatic liquidation threshold to protect lenders
- **Security**: Built with OpenZeppelin's security standards including ReentrancyGuard
- **User-friendly Interface**: Clean and intuitive React-based frontend

## Technical Specifications

- Interest Rate: 10% APR (1000 basis points)
- Liquidation Threshold: 75%
- Smart Contract: Solidity ^0.8.28
- Frontend: React with ethers.js
- Network: Hardhat Local Network (Chain ID: 31337)

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MetaMask wallet
- Hardhat

### MetaMask Setup

1. Install MetaMask browser extension from [metamask.io](https://metamask.io/)

2. Add Hardhat Network to MetaMask:
   - Click on the network dropdown (usually shows "Ethereum Mainnet")
   - Select "Add Network" > "Add Network Manually"
   - Fill in the following details:
     - Network Name: Hardhat Local
     - New RPC URL: http://127.0.0.1:8545
     - Chain ID: 31337
     - Currency Symbol: ETH
     - Block Explorer URL: (leave empty)

3. Import Hardhat Account:
   - Open MetaMask
   - Click on the account icon in the top right
   - Select "Import Account"
   - Select "Private Key" as the import type
   - Copy one of the private keys from your Hardhat node terminal
     (When you run `npx hardhat node`, it displays several test accounts with private keys)
   - Paste the private key and click "Import"
   - The account should now be imported with 10000 test ETH

### Smart Contract Setup

1. Clone the repository:
```bash
git clone https://github.com/kushal7201/lendETH.git
cd lendETH
```

2. Install dependencies:
```bash
npm install
```

3. Deploy the contract:
```bash
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Update the contract address:
Edit `src/config.js` with the deployed contract address

4. Start the development server:
```bash
npm start
```

## Usage

1. Connect your MetaMask wallet to the Hardhat local network (Chain ID: 31337)
2. Deposit ETH as collateral
3. Borrow ETH against your collateral (up to 75% of collateral value)
4. Monitor your loan details and accruing interest in real-time
5. Repay your loan with interest to retrieve your collateral

## Security

- Built with OpenZeppelin's secure smart contract standards
- Implements reentrancy protection
- Uses SafeMath for arithmetic operations
- Features protective measures against common DeFi vulnerabilities

### Contributing

- Kushal Bansal
- Piyush Tiwari

### License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Developers

This project was created as a demonstration of decentralized lending capabilities on the Ethereum blockchain.