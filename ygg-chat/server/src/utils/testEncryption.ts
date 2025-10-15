import dotenv from 'dotenv'
import path from 'path'
import { testEncryption } from './hkdfEncryption'
import { testAllApiKeys, getApiKey, clearCache } from './apiKeyManager'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') })

async function runEncryptionTests() {
  console.log('🔐 Starting HKDF Encryption Tests\n')

  // Test 1: Basic encryption/decryption
  console.log('Test 1: Basic encryption/decryption')
  const testString = 'test-api-key-12345'
  const basicTest = await testEncryption(testString)
  console.log(`✅ Basic test: ${basicTest ? 'PASSED' : 'FAILED'}\n`)

  // Test 2: Test all API keys from environment
  console.log('Test 2: API Key Manager - Encrypt/Decrypt all env keys')
  const apiKeyResults = await testAllApiKeys()

  for (const [keyName, result] of Object.entries(apiKeyResults)) {
    const status = result ? '✅ PASSED' : '❌ FAILED'
    console.log(`  ${keyName}: ${status}`)
  }
  console.log()

  // Test 3: Cache functionality
  console.log('Test 3: Cache functionality')
  clearCache() // Ensure clean start

  const start1 = process.hrtime.bigint()
  const key1 = await getApiKey('OPENROUTER_API_KEY')
  const time1 = Number(process.hrtime.bigint() - start1) / 1000000 // Convert to ms

  const start2 = process.hrtime.bigint()
  const key2 = await getApiKey('OPENROUTER_API_KEY')
  const time2 = Number(process.hrtime.bigint() - start2) / 1000000

  console.log(`  First call (encrypt+decrypt): ${time1.toFixed(2)}ms`)
  console.log(`  Second call (cached): ${time2.toFixed(2)}ms`)
  console.log(`  Keys match: ${key1 === key2 ? '✅ PASSED' : '❌ FAILED'}`)
  console.log(`  Cache working: ${time2 < time1 / 2 ? '✅ PASSED' : '❌ FAILED'}\n`)

  // Test 4: Cache clearing
  console.log('Test 4: Cache clearing')
  clearCache()
  const start3 = process.hrtime.bigint()
  const key3 = await getApiKey('OPENROUTER_API_KEY')
  const time3 = Number(process.hrtime.bigint() - start3) / 1000000

  console.log(`  After cache clear: ${time3.toFixed(2)}ms`)
  console.log(`  Cache cleared correctly: ${time3 > time2 * 2 ? '✅ PASSED' : '❌ FAILED'}\n`)

  // Test 5: Performance test
  console.log('Test 5: Performance test (10 operations)')
  const startPerf = Date.now()
  const promises = []
  for (let i = 0; i < 10; i++) {
    promises.push(testEncryption(`test-key-${i}`))
  }
  const perfResults = await Promise.all(promises)
  const totalTime = Date.now() - startPerf
  const avgTime = totalTime / 10

  console.log(`  Total time: ${totalTime}ms`)
  console.log(`  Average per operation: ${avgTime.toFixed(2)}ms`)
  console.log(`  All operations successful: ${perfResults.every(r => r) ? '✅ PASSED' : '❌ FAILED'}\n`)

  // Summary (ignoring GEMINI_API_KEY since it doesn't exist in env)
  const filteredApiResults = Object.fromEntries(
    Object.entries(apiKeyResults).filter(([key]) => key !== 'GEMINI_API_KEY')
  )

  const allTestsPassed = basicTest &&
    Object.values(filteredApiResults).every(r => r) &&
    key1 === key2 &&
    time2 < time1 / 2 &&
    time3 > time2 * 2 &&
    perfResults.every(r => r)

  console.log('🎯 Test Summary')
  console.log(`Overall result: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`)

  if (allTestsPassed) {
    console.log('\n🎉 HKDF encryption is working correctly!')
    console.log('Ready to integrate with Supabase for per-user encrypted API keys.')
  }
}

// Only run if called directly
if (require.main === module) {
  runEncryptionTests().catch(console.error)
}

export { runEncryptionTests }