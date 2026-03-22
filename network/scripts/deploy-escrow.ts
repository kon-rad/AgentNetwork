/**
 * Deploy AgentEscrow to Base mainnet using solc-js + viem (no Hardhat needed).
 *
 * Prerequisites:
 *   npm install @openzeppelin/contracts solc
 *   Fund ESCROW_DEPLOYER_PRIVATE_KEY with Base mainnet ETH
 *
 * Usage:
 *   npx tsx scripts/deploy-escrow.ts
 *   npx tsx scripts/deploy-escrow.ts --compile-only   (compile + save ABI, skip deploy)
 *
 * After deployment, add the printed address to .env.local as:
 *   NEXT_PUBLIC_ESCROW_ADDRESS=0x...
 *   ESCROW_ADDRESS=0x...
 */

import { createWalletClient, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import solc from 'solc'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, join } from 'path'

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Base mainnet USDC
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || '0x0eEf9b6C1f35266A2440E0263C5B89AcaDd12d72'

const COMPILE_ONLY = process.argv.includes('--compile-only')

/**
 * Resolve Solidity imports from node_modules (e.g. @openzeppelin/contracts/...)
 */
function findImports(importPath: string): { contents: string } | { error: string } {
  const candidates = [
    resolve(__dirname, '../node_modules', importPath),
    resolve(__dirname, '../../node_modules', importPath),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { contents: readFileSync(candidate, 'utf8') }
    }
  }
  return { error: `File not found: ${importPath}` }
}

async function main() {
  // 1. Compile with solc-js
  const contractPath = resolve(__dirname, '../contracts/AgentEscrow.sol')
  console.log('Compiling AgentEscrow.sol with solc-js...')

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

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }))

  if (output.errors?.some((e: { severity: string }) => e.severity === 'error')) {
    console.error('Compilation errors:', output.errors)
    process.exit(1)
  }

  // Show warnings (non-fatal)
  if (output.errors?.length) {
    for (const w of output.errors) {
      if (w.severity === 'warning') console.warn(`[solc warning] ${w.message}`)
    }
  }

  const contract = output.contracts['AgentEscrow.sol']['AgentEscrow']
  const abi = contract.abi
  const bytecode = `0x${contract.evm.bytecode.object}` as `0x${string}`

  // Save ABI for use in the app
  const abiDir = resolve(__dirname, '../src/lib/chain/abi')
  mkdirSync(abiDir, { recursive: true })
  writeFileSync(resolve(abiDir, 'AgentEscrow.json'), JSON.stringify(abi, null, 2))
  console.log('ABI saved to src/lib/chain/abi/AgentEscrow.json')
  console.log(`Bytecode length: ${bytecode.length} chars`)

  if (COMPILE_ONLY) {
    console.log('\n--compile-only flag set. Skipping deployment.')
    return
  }

  // 2. Deploy
  const DEPLOYER_KEY = process.env.ESCROW_DEPLOYER_PRIVATE_KEY as `0x${string}`
  if (!DEPLOYER_KEY) {
    console.error('Set ESCROW_DEPLOYER_PRIVATE_KEY in .env.local')
    process.exit(1)
  }

  const account = privateKeyToAccount(DEPLOYER_KEY)
  console.log(`Deploying from: ${account.address}`)

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  })

  const publicClient = createPublicClient({
    chain: base,
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
  console.log(`BaseScan: https://basescan.org/address/${escrowAddress}`)
  console.log(`\nAdd to .env.local:`)
  console.log(`ESCROW_ADDRESS=${escrowAddress}`)
  console.log(`NEXT_PUBLIC_ESCROW_ADDRESS=${escrowAddress}`)
}

main().catch(console.error)
