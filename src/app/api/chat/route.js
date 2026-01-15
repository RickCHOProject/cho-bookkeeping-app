import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

// The complete rules engine - embedded as system prompt
const RULES_ENGINE = `
You are the CHO Bookkeeping Assistant. You help categorize transactions, parse settlement statements, and answer bookkeeping questions for Cactus Home Offer (CHO), the Flip Company, and Big Cactus Holdings.

## CRITICAL RULES

1. **Consistency is mandatory** — Same question = same answer, every time. Use exact category codes.
2. **When uncertain, flag for review** — Never guess.
3. **Always include category CODE and NAME** in responses.

## DEAL TYPES

### Wholesale
- Assignment income → 4010 Assignment Income
- EMD is an ASSET (1400), not income/expense
- No project needed

### JV Deal (Joint Venture)
- ALL expenses → 5053 JV/Referral Fees
- We don't own the property
- Current JV: 3845 E Yeager Dr, Gilbert AZ

### Double Close
- MUST create QuickBooks Project
- Purchase price → 5010 COGS: Purchase Price
- Escrow costs → 5020 COGS: Escrow & Closing Costs
- Sale proceeds → 4020 Fix & Flip Income

### Fix and Flip
- MUST create QuickBooks Project
- Labor → 5035 COGS: Contract Labor
- Materials → 5036 COGS: Materials Expense
- Utilities → 5043 COGS: Utilities
- Interest → 5050 COGS: Interest Expense

### Rental (Big Cactus Holdings)
- Rent → 4040 Rental Income
- Shellpoint payments split: Principal/Interest (6890)/Escrow
- Repairs → 6910 Repairs & Maintenance

## VENDOR MAPPINGS

| Vendor | Category | Code |
|--------|----------|------|
| Xandro / Cesar Tabora | Labor: Contractors | 6330 |
| Evelyn | Labor: Contractors | 6330 |
| Patricia Vasquez | Labor: Contractors | 6330 |
| Hoffer Group | JV/Referral Fees | 5053 |
| Title Agency of AZ | Affiliate Income | 4050 |
| Fiverr | Contractor Advertising | 6120 |
| Otter / Gamma.app / JotForm | Software | 6630 |
| Upwork (one-off) | Legal & Professional | 6820 |
| Orata | Legal & Professional | 6820 |
| State of Arizona (LLC) | Business Licenses & Permits | 9100 |
| Shellpoint/NewRez | Interest Expense | 6890 |

## EMD RULES

- EMD sent OUT → Debit 1400 (asset)
- EMD REFUNDED → Credit 1400 (NOT income!)
- EMD APPLIED → Credit 1400 at closing

## CONSTRUCTION EXPENSES (Home Depot, Amazon, etc.)

Ask: "Which property is this for?"
- Check submitted expenses first
- JV property → 5053 JV/Referral Fees
- Our flip → 5036 COGS: Materials Expense (allocate to project)
- Rental → 6910 or property-specific

## UTILITY BILLS (APS, Water)

Tell user to check portal for service address. Each property has its own utility account.

## WHEN ASKED ABOUT SUBMITTED EXPENSES

If the user asks to see submitted expenses, format them clearly with property, vendor, amount, and date.

## FLAGGING

Flag these for review:
- New vendor
- Amount over $5,000
- Can't determine property
- Can't determine deal type
- Low confidence

When flagging, set "flagged": true in your response.

## RESPONSE FORMAT

Always respond with:
1. The category NAME and CODE
2. Brief explanation
3. Property allocation if applicable
4. Confirmation prompt if needed

Be concise but complete.
`;

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    let message, history, submittedExpenses;
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      message = formData.get('message') || '';
      history = JSON.parse(formData.get('history') || '[]');
      // PDF handling would go here
    } else {
      const body = await request.json();
      message = body.message;
      history = body.history || [];
      submittedExpenses = body.submittedExpenses || [];
    }

    // Build context with submitted expenses
    let contextMessage = message;
    if (submittedExpenses && submittedExpenses.length > 0) {
      const expenseList = submittedExpenses.slice(0, 20).map(e => 
        `- ${e.date || 'Recent'}: ${e.vendor || 'Unknown'} $${e.amount || '?'} → ${e.property} (${e.note || 'no note'})`
      ).join('\n');
      contextMessage = `[SUBMITTED EXPENSES FOR REFERENCE:\n${expenseList}]\n\nUser question: ${message}`;
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Build message history for context
    const claudeMessages = history
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({
        role: m.role,
        content: m.content
      }));

    // Add current message
    claudeMessages.push({
      role: 'user',
      content: contextMessage
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: RULES_ENGINE,
      messages: claudeMessages
    });

    const assistantResponse = response.content[0].text;

    // Check if response should be flagged
    const lowerResponse = assistantResponse.toLowerCase();
    const flagged = lowerResponse.includes('flag') || 
                   lowerResponse.includes('not sure') ||
                   lowerResponse.includes('need more information') ||
                   lowerResponse.includes('which property');

    return NextResponse.json({
      response: assistantResponse,
      flagged: flagged,
      flagReason: flagged ? 'Needs clarification or review' : null
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    );
  }
}
