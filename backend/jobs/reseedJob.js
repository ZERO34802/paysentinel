import 'dotenv/config';
import { Client } from '@elastic/elasticsearch';
import { generateTransactions } from '../data/seedLogs.js';

const INDEX = 'transactions';

let client = null;

function getElasticClient() {
  if (!client) {
    const url = process.env.ELASTIC_URL;
    const apiKey = process.env.ELASTIC_API_KEY;

    if (!url || !apiKey) {
      throw new Error('ELASTIC_URL and ELASTIC_API_KEY must be set in .env');
    }

    client = new Client({
      node: url,
      auth: { apiKey },
    });
  }
  return client;
}

function getLastHourTransactions() {
  const oneHourAgoMs = Date.now() - 60 * 60 * 1000;
  return generateTransactions().filter(
    (t) => new Date(t.timestamp).getTime() >= oneHourAgoMs
  );
}

async function bulkIndex(es, transactions) {
  if (transactions.length === 0) return;

  const body = transactions.flatMap((doc) => [
    { index: { _index: INDEX, _id: doc.transaction_id } },
    doc,
  ]);

  const result = await es.bulk({ refresh: true, body });

  if (result.errors) {
    const failed = result.items.filter((item) => item.index?.error);
    throw new Error(`Bulk index failed for ${failed.length} documents`);
  }
}

export async function reseedLastHour() {
  const es = getElasticClient();
  const transactions = getLastHourTransactions();

  await es.deleteByQuery({
    index: INDEX,
    refresh: true,
    query: {
      range: { timestamp: { gte: 'now-2h' } },
    },
  });

  await bulkIndex(es, transactions);

  console.log(`Reseeded ${transactions.length} fresh transactions at ${new Date().toISOString()}`);

  return { count: transactions.length };
}
