const { Client } = require('pg');

// Configuration de connexion
const config = {
  host: 'dpg-d74t286a2pns73ap1dp0-a.oregon-postgres.render.com',
  port: 5432,
  database: 'mkfifx',
  user: 'mkfifx_user',
  password: 'gDx1L4YMF64q1iugFRbjWtMpTEAeiaxe',
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000,
  query_timeout: 10000
};

async function testConnection() {
  console.log('🔗 Test de connexion PostgreSQL...');
  console.log('📋 Configuration:');
  console.log(`   Hôte: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Base: ${config.database}`);
  console.log(`   Utilisateur: ${config.user}`);
  console.log(`   SSL: ${config.ssl ? 'Activé' : 'Désactivé'}`);
  console.log('');

  const client = new Client(config);

  try {
    console.log('⏳ Connexion en cours...');
    await client.connect();
    console.log('✅ Connexion réussie à la base de données!');
    
    // Test de requête simple
    console.log('📊 Test de requête...');
    const result = await client.query('SELECT version()');
    console.log('✅ Version PostgreSQL:', result.rows[0].version);
    
    // Test de création de table
    console.log('🗄️ Test de création de table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table de test créée avec succès!');
    
    // Test d'insertion
    console.log('📝 Test d\'insertion...');
    const insertResult = await client.query(
      'INSERT INTO test_table (message) VALUES ($1) RETURNING *',
      ['Test de connexion FIFA PRO']
    );
    console.log('✅ Donnée insérée:', insertResult.rows[0]);
    
    // Test de sélection
    console.log('🔍 Test de sélection...');
    const selectResult = await client.query('SELECT * FROM test_table');
    console.log('✅ Données récupérées:', selectResult.rows.length, 'lignes');
    
    // Nettoyage
    console.log('🧹 Nettoyage de la table de test...');
    await client.query('DROP TABLE IF EXISTS test_table');
    console.log('✅ Table de test supprimée!');
    
    console.log('');
    console.log('🎯 TOUS LES TESTS RÉUSSIS!');
    console.log('✅ La base de données PostgreSQL est pleinement fonctionnelle!');
    
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
    console.error('📋 Détails de l\'erreur:');
    console.error(`   Code: ${error.code}`);
    console.error(`   Sévérité: ${error.severity}`);
    console.error(`   Hint: ${error.hint}`);
    console.error(`   Position: ${error.position}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('🔥 SOLUTION: Vérifier que l\'hôte et le port sont corrects');
    } else if (error.code === 'ENOTFOUND') {
      console.error('🔥 SOLUTION: Vérifier que le nom d\'hôte est correct');
    } else if (error.code === 'ECONNRESET') {
      console.error('🔥 SOLUTION: Problème de réseau ou firewall');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('🔥 SOLUTION: Timeout - vérifier la connexion internet');
    }
    
  } finally {
    await client.end();
    console.log('🔌 Connexion fermée');
  }
}

testConnection();
