/**
 * Deploy AgentEscrow to Base Sepolia using solc + viem (no Hardhat needed).
 *
 * Prerequisites:
 *   npm install -g solc   (or: brew install solidity)
 *   Fund ESCROW_DEPLOYER_PRIVATE_KEY with Base Sepolia ETH
 *
 * Usage:
 *   npx tsx scripts/deploy-escrow.ts
 *
 * After deployment, add the printed address to .env.local as:
 *   NEXT_PUBLIC_ESCROW_ADDRESS=0x...
 *   ESCROW_ADDRESS=0x...
 */

import { createWalletClient, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' // Base Sepolia USDC
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || '0x0eEf9b6C1f35266A2440E0263C5B89AcaDd12d72'
const DEPLOYER_KEY = process.env.ESCROW_DEPLOYER_PRIVATE_KEY as `0x${string}`

if (!DEPLOYER_KEY) {
  console.error('Set ESCROW_DEPLOYER_PRIVATE_KEY in .env.local')
  process.exit(1)
}

async function main() {
  // 1. Compile with solc
  const contractPath = resolve(__dirname, '../contracts/AgentEscrow.sol')
  console.log('Compiling AgentEscrow.sol...')

  // Create solc input JSON
  const input = {
    language: 'Solidity',
    sources: {
      'AgentEscrow.sol': { content: readFileSync(contractPath, 'utf8') },
    },
    settings: {
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
      optimizer: { enabled: true, runs: 200 },
    },
  }

  // Try to find OpenZeppelin imports from node_modules
  const nodeModulesPath = resolve(__dirname, '../node_modules')

  const inputPath = resolve(__dirname, '../contracts/solc-input.json')
  writeFileSync(inputPath, JSON.stringify(input))

  let output: string
  try {
    output = execSync(
      `solc --standard-json --allow-paths "${nodeModulesPath}" < "${inputPath}"`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
    )
  } catch (err) {
    console.error('solc failed. Install it with: brew install solidity')
    throw err
  }

  const compiled = JSON.parse(output)

  if (compiled.errors?.some((e: { severity: string }) => e.severity === 'error')) {
    console.error('Compilation errors:', compiled.errors)
    process.exit(1)
  }

  const contract = compiled.contracts['AgentEscrow.sol']['AgentEscrow']
  const abi = contract.abi
  const bytecode = `0x${contract.evm.bytecode.object}` as `0x${string}`

  // Save ABI for use in the app
  const abiDir = resolve(__dirname, '../src/lib/chain/abi')
  mkdirSync(abiDir, { recursive: true })
  writeFileSync(resolve(abiDir, 'AgentEscrow.json'), JSON.stringify(abi, null, 2))
  console.log('ABI saved to src/lib/chain/abi/AgentEscrow.json')

  // 2. Deploy
  const account = privateKeyToAccount(DEPLOYER_KEY)
  console.log(`Deploying from: ${account.address}`)

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  })

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  })

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [USDC_ADDRESS, TREASURY_ADDRESS],
  })

  console.log(`Deploy tx: ${hash}`)
  console.log('Waiting for confirmation...')

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  const escrowAddress = receipt.contractAddress

  console.log('\n=== DEPLOYMENT COMPLETE ===')
  console.log(`Escrow Address: ${escrowAddress}`)
  console.log(`BaseScan: https://sepolia.basescan.org/address/${escrowAddress}`)
  console.log(`\nAdd to .env.local:`)
  console.log(`ESCROW_ADDRESS=${escrowAddress}`)
  console.log(`NEXT_PUBLIC_ESCROW_ADDRESS=${escrowAddress}`)
}

main().catch(console.error)
