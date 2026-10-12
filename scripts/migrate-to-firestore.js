// Migration script to transfer data from local database.json to Firestore
const fs = require('fs');
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firestore
const { getFirestore } = require('firebase-admin/firestore');
let db;
try {
  // Check if default app already exists
  admin.app();
} catch {
  // App doesn't exist, initialize it
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccount) {
      let parsedAccount;
      try {
        parsedAccount = JSON.parse(serviceAccount);
        // Fix private_key newline characters if they are escaped
        if (parsedAccount.private_key && parsedAccount.private_key.includes('\\n')) {
          parsedAccount.private_key = parsedAccount.private_key.replace(/\\n/g, '\n');
        }
        admin.initializeApp({
          credential: admin.credential.cert(parsedAccount)
        });
      } catch (parseError) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', parseError);
        // Fallback to application default credentials (for local development)
        admin.initializeApp();
      }
    } else {
      // Fallback to application default credentials (for local development)
      admin.initializeApp();
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    // Fallback to application default credentials
    admin.initializeApp();
  }
}
db = getFirestore();

async function migrateData() {
  try {
    // Read local database.json
    const dbPath = path.join(__dirname, '..', 'database.json');
    
    if (!fs.existsSync(dbPath)) {
      console.log('No database.json found. Nothing to migrate.');
      return;
    }
    
    const rawData = fs.readFileSync(dbPath, 'utf8');
    const database = JSON.parse(rawData);
    
    const keys = Object.keys(database);
    if (keys.length === 0) {
      console.log('database.json is empty. Nothing to migrate.');
      return;
    }
    
    console.log(`Found ${keys.length} records to migrate...`);
    
    // Batch write to Firestore (max 500 per batch)
    const batchSize = 500;
    let migratedCount = 0;
    
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = db.batch();
      const batchKeys = keys.slice(i, i + batchSize);
      
      batchKeys.forEach(key => {
        const docRef = db.collection('shipments').doc(key);
        batch.set(docRef, database[key]);
      });
      
      await batch.commit();
      migratedCount += batchKeys.length;
      console.log(`Migrated ${migratedCount}/${keys.length} records...`);
    }
    
    console.log(`Migration complete! ${migratedCount} records transferred to Firestore.`);
    console.log('NOTE: Local database.json has NOT been modified or deleted.');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateData().catch(console.error);
}

module.exports = { migrateData };