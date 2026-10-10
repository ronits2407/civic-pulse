import { createServiceClient } from '../lib/db/server'

async function main() {
  const email = process.argv[2]
  const supabase = createServiceClient()

  if (!email) {
    console.log('\n--- Current Registered Profiles ---')
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch profiles:', error.message)
      process.exit(1)
    }

    console.table(profiles)
    console.log('\nUsage to promote a user:')
    console.log('  bun run promote <email>')
    console.log('Example: bun run promote myemail@gmail.com\n')
    process.exit(0)
  }

  console.log(`Promoting ${email} to admin...`)
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('email', email)
    .select('id, email, role')

  if (error) {
    console.error('Failed to update role:', error.message)
    process.exit(1)
  }

  if (!data || data.length === 0) {
    console.log(`No user profile found for: ${email}`)
    console.log('Please register or log into CivicPulse first so your profile is created, then run this script again.')
    process.exit(1)
  }

  console.log(`Success! User ${email} is now an admin:`)
  console.log(data[0])
}

main()
