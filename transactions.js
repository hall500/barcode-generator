const fs = require('fs');
const uuid = require('uuid');
const axios = require('axios');
const path = require('path');

// Function to generate a random date within a specified range
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Function to generate random transactions for a one-week period
function generateRandomTransactions(startDate, endDate, numberOfTransactions) {
  const transactions = [];

  for (let i = 0; i < numberOfTransactions; i++) {
    const transactionDate = randomDate(startDate, endDate);

    // Format the date as "Day, Month Day, Year" (e.g., "Wednesday, Sep 20, 2023")
    const formattedDate = transactionDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const amount = Math.random() * 1000; // Random amount between 0 and 1000

    transactions.push({
      transaction_date: formattedDate,
      amount: amount.toFixed(2), // Format amount to two decimal places
    });
  }

  // Sort transactions by ascending date
  transactions.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));

  return transactions;
}

const newDate = new Date();
const today = new Date();
// Define the start and end dates for the one-week period
//newDate.setDate(newDate.getDate() - 7);

// Define the start and end dates for the one-month period
newDate.setMonth(newDate.getMonth() - 1);

// Generate random transactions for the one-week period
const numberOfTransactions = 50; // Change this as needed
const transactions = generateRandomTransactions(newDate, today, numberOfTransactions);

// Save the transactions to a JSON file
const jsonFilePath = path.join(__dirname, 'transactions.json');
fs.writeFileSync(jsonFilePath, JSON.stringify(transactions, null, 2)); // 2-space indentation for readability

console.log(`Transactions saved to ${jsonFilePath}`);