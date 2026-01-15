import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// GET - Fetch all expenses
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ expenses: data });
  } catch (error) {
    console.error('Fetch expenses error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses', expenses: [] },
      { status: 500 }
    );
  }
}

// POST - Submit new expense
export async function POST(request) {
  try {
    const formData = await request.formData();
    
    const property = formData.get('property');
    const amount = formData.get('amount');
    const vendor = formData.get('vendor');
    const note = formData.get('note');
    const submittedBy = formData.get('submittedBy') || 'Team';
    const receipt = formData.get('receipt');

    // Handle receipt upload if present
    let receiptUrl = null;
    if (receipt && receipt.size > 0) {
      const fileName = `receipts/${Date.now()}-${receipt.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, receipt);

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);
        receiptUrl = urlData.publicUrl;
      }
    }

    // Insert expense record
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        property,
        amount,
        vendor,
        note,
        submitted_by: submittedBy,
        receipt_url: receiptUrl,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ expense: data });
  } catch (error) {
    console.error('Submit expense error:', error);
    return NextResponse.json(
      { error: 'Failed to submit expense' },
      { status: 500 }
    );
  }
}
