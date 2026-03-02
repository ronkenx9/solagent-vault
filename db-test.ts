import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

async function verifyDb() {
    console.log('URL:', process.env.SUPABASE_URL);
    console.log('KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '(present)' : 'MISSING');

    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase.from('transactions').insert({
        agent_id: 'agent-momentum-01',
        action: 'TEST',
        lamports: 100,
        status: 'TESTING',
        reasoning: 'Manual network check'
    }).select();

    if (error) {
        console.error('DB Insert Error:', error);
    } else {
        console.log('Success! Data written:', data);
    }
}

verifyDb();
