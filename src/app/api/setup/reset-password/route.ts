import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@/lib/database/simple-client';

export async function POST(request: NextRequest) {
  try {
    const { email, newPassword } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json({
        success: false,
        error: 'Email and newPassword are required'
      }, { status: 400 });
    }

    // Hash the new password
    const hashedPassword = await hash(newPassword, 12);

    // Update user password
    const updatedUser = await db.update('user', {
      where: { email: email.toLowerCase() },
      data: { password: hashedPassword }
    });

    if (!updatedUser) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name
      }
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to reset password',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}