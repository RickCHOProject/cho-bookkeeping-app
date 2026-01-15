import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// GET - Fetch flagged items
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('flagged_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ flags: data });
  } catch (error) {
    console.error('Fetch flags error:', error);
    return NextResponse.json({ flags: [] }, { status: 500 });
  }
}

// POST - Save flagged item
export async function POST(request) {
  try {
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('flagged_items')
      .insert({
        query: body.query,
        response: body.response,
        flag_reason: body.flagReason || 'Needs review',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ flag: data });
  } catch (error) {
    console.error('Save flag error:', error);
    return NextResponse.json({ error: 'Failed to save flag' }, { status: 500 });
  }
}
