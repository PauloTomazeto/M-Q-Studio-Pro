/**
 * Quick test script for Supabase upload configuration
 * Run this in the browser console or via Node.js with ts-node
 *
 * Steps:
 * 1. Ensure .env is configured with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 * 2. Run: npm run test:supabase (if configured)
 * 3. Or paste in browser console after loading the app
 */

import { supabase } from './src/supabase'

async function testSupabaseUpload() {
  console.log('🧪 Starting Supabase Upload Test...\n')

  try {
    // 1. Test Supabase connection
    console.log('1️⃣ Testing Supabase connection...')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.warn('⚠️  Not authenticated. Sign in first to test auth-required features.')
    } else {
      console.log('✅ Authenticated as:', user.email)
    }

    // 2. Test bucket access
    console.log('\n2️⃣ Testing bucket access...')
    const bucketName = import.meta.env.VITE_STORAGE_BUCKET_NAME || 'user-uploads'
    console.log(`   Bucket name: ${bucketName}`)

    try {
      const { data: buckets, error } = await supabase.storage.listBuckets()
      if (error) throw error

      const bucketExists = buckets?.some(b => b.name === bucketName)
      if (bucketExists) {
        console.log(`✅ Bucket "${bucketName}" exists and is accessible`)
      } else {
        console.warn(`❌ Bucket "${bucketName}" not found. Create it in Supabase dashboard.`)
      }
    } catch (err: any) {
      console.error('❌ Bucket access failed:', err.message)
      return
    }

    // 3. Test CORS configuration
    console.log('\n3️⃣ Testing CORS configuration...')
    try {
      const testUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/buckets`
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        }
      })
      if (response.ok) {
        console.log('✅ CORS and authentication headers working correctly')
      } else {
        console.warn(`⚠️  Server returned ${response.status}. Check Supabase CORS settings.`)
      }
    } catch (err: any) {
      console.error('❌ CORS error detected:', err.message)
      console.error('   Fix: Configure CORS in Supabase Storage settings')
    }

    // 4. Test small file upload (if authenticated)
    if (user) {
      console.log('\n4️⃣ Testing small file upload...')
      try {
        const testBlob = new Blob(['test content'], { type: 'text/plain' })
        const testFile = new File([testBlob], 'test-upload.txt', { type: 'text/plain' })

        const path = `${user.id}/test-${Date.now()}.txt`
        const { data, error } = await supabase.storage
          .from(bucketName)
          .upload(path, testFile, { upsert: false })

        if (error) throw error
        console.log('✅ Test file uploaded successfully:', data.path)

        // Clean up
        await supabase.storage.from(bucketName).remove([path])
        console.log('✅ Test file cleaned up')
      } catch (err: any) {
        console.error('❌ Upload test failed:', err.message)
      }
    }

    // 5. Summary
    console.log('\n📋 Test Summary:')
    console.log('✅ If all tests pass, your Supabase setup is correct!')
    console.log('❌ If you see errors, check:')
    console.log('   - Supabase URL and anon key in .env')
    console.log('   - Storage bucket exists in Supabase')
    console.log('   - CORS is configured in Storage settings')
    console.log('   - You are authenticated (for upload tests)')

  } catch (err: any) {
    console.error('💥 Unexpected error:', err)
  }
}

// Run test if this file is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  testSupabaseUpload().catch(console.error)
} else {
  // Browser environment - attach to window for console access
  (window as any).testSupabaseUpload = testSupabaseUpload
  console.log('✅ Test function ready. Run: testSupabaseUpload()')
}

export { testSupabaseUpload }
