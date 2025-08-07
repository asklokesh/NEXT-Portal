#!/bin/bash

# Increase Node.js memory limit for linting
export NODE_OPTIONS="--max-old-space-size=4096"

echo "Running Next.js lint..."
npx next lint

if [ $? -eq 0 ]; then
 echo "Next.js lint passed "
 
 echo "Running ESLint..."
 npx eslint . --ext .ts,.tsx --max-warnings 0
 
 if [ $? -eq 0 ]; then
 echo "ESLint passed "
 echo "All linting checks passed!"
 exit 0
 else
 echo "ESLint failed "
 exit 1
 fi
else
 echo "Next.js lint failed "
 exit 1
fi