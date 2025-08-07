import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ComplianceScanner, ComplianceRule } from '@/lib/security/ComplianceScanner';

// GET /api/catalog/compliance/rules - Get all compliance rules
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scanner = new ComplianceScanner();
    const rules = scanner.getAllRules();

    return NextResponse.json({
      success: true,
      rules,
      total: rules.length,
    });
  } catch (error) {
    console.error('Error fetching compliance rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch compliance rules' },
      { status: 500 }
    );
  }
}

// POST /api/catalog/compliance/rules - Add a custom compliance rule
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rule } = body;

    if (!rule || !rule.id || !rule.name || !rule.check) {
      return NextResponse.json(
        { error: 'Invalid rule definition' },
        { status: 400 }
      );
    }

    // In a real implementation, this would save to a database
    // and dynamically add the rule to the scanner
    
    return NextResponse.json({
      success: true,
      message: 'Rule added successfully',
      rule,
    });
  } catch (error) {
    console.error('Error adding compliance rule:', error);
    return NextResponse.json(
      { error: 'Failed to add compliance rule' },
      { status: 500 }
    );
  }
}

// DELETE /api/catalog/compliance/rules/:ruleId - Remove a compliance rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ruleId } = params;

    // In a real implementation, this would remove from database
    // and dynamically remove the rule from the scanner

    return NextResponse.json({
      success: true,
      message: 'Rule removed successfully',
      ruleId,
    });
  } catch (error) {
    console.error('Error removing compliance rule:', error);
    return NextResponse.json(
      { error: 'Failed to remove compliance rule' },
      { status: 500 }
    );
  }
}