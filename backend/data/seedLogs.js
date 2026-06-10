import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';
import { Client } from '@elastic/elasticsearch';

const PAYMENT_METHODS = ['UPI', 'card', 'netbanking', 'wallet'];
const GATEWAYS = ['Razorpay', 'PayU', 'Stripe'];
const BANKS = ['HDFC', 'SBI', 'Axis', 'ICICI'];
const ERROR_CODES = [
  'GATEWAY_TIMEOUT',
  'INSUFFICIENT_FUNDS',
  'BANK_DECLINED',
  'UPI_COLLECT_FAILED',
  'CARD_EXPIRED',
  'NETWORK_ERROR',
  'AUTH_FAILED',
];
const USER_DEVICES = ['mobile', 'web', 'app'];
const IP_REGIONS = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata'];

const TOP_MERCHANTS = ['merchant_001', 'merchant_002', 'merchant_003'];
const OTHER_MERCHANTS = Array.from({ length: 17 }, (_, i) =>
  `merchant_${String(i + 4).padStart(3, '0')}`
);

const TOTAL_TRANSACTIONS = 10000;
const LAST_HOUR_COUNT = 800;
const HISTORICAL_COUNT = TOTAL_TRANSACTIONS - LAST_HOUR_COUNT;

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAmount() {
  return Math.round((Math.random() * 49900 + 100) * 100) / 100;
}

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function randomTimestampBetween(start, end) {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return new Date(startMs + Math.random() * (endMs - startMs));
}

function pickMerchantId() {
  if (Math.random() < 0.2) {
    return randomChoice(TOP_MERCHANTS);
  }
  return randomChoice(OTHER_MERCHANTS);
}

function shouldFail(paymentMethod, gateway, bank, isLastHour) {
  if (paymentMethod === 'UPI' && gateway === 'Razorpay') {
    const rate = isLastHour ? 0.4 : 0.03;
    return Math.random() < rate;
  }

  if (paymentMethod === 'card' && bank === 'HDFC') {
    const rate = isLastHour ? 0.25 : 0.02;
    return Math.random() < rate;
  }

  const baseRate = isLastHour ? 0.02 : 0.01;
  return Math.random() < baseRate;
}

function failureDetailsForErrorCode(errorCode) {
  switch (errorCode) {
    case 'GATEWAY_TIMEOUT':
      return {
        failure_stage: 'timeout',
        response_time_ms: randomInt(8000, 15000),
        retry_count: randomInt(2, 3),
      };
    case 'INSUFFICIENT_FUNDS':
      return {
        failure_stage: 'bank_processing',
        response_time_ms: randomInt(250, 600),
        retry_count: 0,
      };
    case 'BANK_DECLINED':
      return {
        failure_stage: 'bank_processing',
        response_time_ms: randomInt(3000, 9000),
        retry_count: randomInt(0, 1),
      };
    case 'UPI_COLLECT_FAILED':
      return {
        failure_stage: 'gateway_auth',
        response_time_ms: randomInt(4000, 12000),
        retry_count: randomInt(0, 2),
      };
    case 'CARD_EXPIRED':
      return {
        failure_stage: 'fraud_check',
        response_time_ms: randomInt(3000, 7000),
        retry_count: 0,
      };
    case 'NETWORK_ERROR':
      return {
        failure_stage: 'network',
        response_time_ms: randomInt(3000, 12000),
        retry_count: randomInt(1, 3),
      };
    case 'AUTH_FAILED':
      return {
        failure_stage: 'gateway_auth',
        response_time_ms: randomInt(4000, 11000),
        retry_count: randomInt(0, 2),
      };
    default:
      return {
        failure_stage: 'network',
        response_time_ms: randomInt(3000, 12000),
        retry_count: randomInt(0, 2),
      };
  }
}

function pickUpiRazorpayFailure(isLastHour) {
  if (isLastHour) {
    const roll = Math.random();
    if (roll < 0.65) {
      const error_code = randomChoice(['AUTH_FAILED', 'UPI_COLLECT_FAILED']);
      return { error_code, ...failureDetailsForErrorCode(error_code) };
    }
    if (roll < 0.85) {
      return { error_code: 'GATEWAY_TIMEOUT', ...failureDetailsForErrorCode('GATEWAY_TIMEOUT') };
    }
    return { error_code: 'NETWORK_ERROR', ...failureDetailsForErrorCode('NETWORK_ERROR') };
  }

  const error_code = randomChoice(['AUTH_FAILED', 'UPI_COLLECT_FAILED', 'GATEWAY_TIMEOUT', 'NETWORK_ERROR']);
  return { error_code, ...failureDetailsForErrorCode(error_code) };
}

function pickHdfcCardFailure() {
  if (Math.random() < 0.75) {
    return { error_code: 'BANK_DECLINED', ...failureDetailsForErrorCode('BANK_DECLINED') };
  }

  const error_code = randomChoice(['CARD_EXPIRED', 'INSUFFICIENT_FUNDS', 'GATEWAY_TIMEOUT', 'BANK_DECLINED']);
  return { error_code, ...failureDetailsForErrorCode(error_code) };
}

function pickGenericFailure() {
  const error_code = randomChoice(ERROR_CODES);
  return { error_code, ...failureDetailsForErrorCode(error_code) };
}

function createTransaction(id, timestamp, isLastHour) {
  const payment_method = randomChoice(PAYMENT_METHODS);
  const gateway = randomChoice(GATEWAYS);
  const bank = randomChoice(BANKS);
  const failed = shouldFail(payment_method, gateway, bank, isLastHour);

  const transaction = {
    transaction_id: `txn_${String(id).padStart(8, '0')}`,
    timestamp: timestamp.toISOString(),
    payment_method,
    gateway,
    bank,
    amount: randomAmount(),
    merchant_id: pickMerchantId(),
    user_device: randomChoice(USER_DEVICES),
    ip_region: randomChoice(IP_REGIONS),
    status: failed ? 'failed' : 'success',
  };

  if (!failed) {
    return {
      ...transaction,
      error_code: null,
      failure_stage: null,
      response_time_ms: randomInt(200, 800),
      retry_count: 0,
    };
  }

  let failureDetails;
  if (payment_method === 'UPI' && gateway === 'Razorpay') {
    failureDetails = pickUpiRazorpayFailure(isLastHour);
  } else if (payment_method === 'card' && bank === 'HDFC') {
    failureDetails = pickHdfcCardFailure();
  } else {
    failureDetails = pickGenericFailure();
  }

  return {
    ...transaction,
    error_code: failureDetails.error_code,
    failure_stage: failureDetails.failure_stage,
    response_time_ms: failureDetails.response_time_ms,
    retry_count: failureDetails.retry_count,
  };
}

export function generateTransactions() {
  const now = new Date();
  const oneHourAgo = hoursAgo(1);
  const sevenDaysAgo = hoursAgo(24 * 7);
  const transactions = [];

  for (let i = 0; i < HISTORICAL_COUNT; i++) {
    const timestamp = randomTimestampBetween(sevenDaysAgo, oneHourAgo);
    transactions.push(createTransaction(i + 1, timestamp, false));
  }

  for (let i = 0; i < LAST_HOUR_COUNT; i++) {
    const timestamp = randomTimestampBetween(oneHourAgo, now);
    transactions.push(createTransaction(HISTORICAL_COUNT + i + 1, timestamp, true));
  }

  return transactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function getElasticClient() {
  const url = process.env.ELASTIC_URL;
  const apiKey = process.env.ELASTIC_API_KEY;

  if (!url || !apiKey) {
    throw new Error('ELASTIC_URL and ELASTIC_API_KEY must be set in .env');
  }

  return new Client({
    node: url,
    auth: { apiKey },
  });
}

async function ensureIndex(client, indexName, mappings) {
  const exists = await client.indices.exists({ index: indexName });
  if (!exists) {
    await client.indices.create({
      index: indexName,
      body: { mappings },
    });
    console.log(`Created index: ${indexName}`);
  } else {
    await client.indices.putMapping({
      index: indexName,
      body: mappings,
    });
    console.log(`Updated mappings for index: ${indexName}`);
  }
}

async function bulkIndex(client, indexName, transactions) {
  if (transactions.length === 0) return;

  const body = transactions.flatMap((doc) => [
    { index: { _index: indexName, _id: doc.transaction_id } },
    doc,
  ]);

  const result = await client.bulk({ refresh: true, body });

  if (result.errors) {
    const failed = result.items.filter((item) => item.index?.error);
    throw new Error(`Bulk index failed for ${failed.length} documents`);
  }
}

async function seed() {
  const client = getElasticClient();
  const transactions = generateTransactions();

  const transactionMappings = {
    properties: {
      transaction_id: { type: 'keyword' },
      timestamp: { type: 'date' },
      payment_method: { type: 'keyword' },
      gateway: { type: 'keyword' },
      bank: { type: 'keyword' },
      error_code: { type: 'keyword' },
      amount: { type: 'float' },
      status: { type: 'keyword' },
      response_time_ms: { type: 'integer' },
      retry_count: { type: 'integer' },
      failure_stage: { type: 'keyword' },
      merchant_id: { type: 'keyword' },
      user_device: { type: 'keyword' },
      ip_region: { type: 'keyword' },
    },
  };

  const incidentMappings = {
    properties: {
      incident_id: { type: 'keyword' },
      created_at: { type: 'date' },
      summary: { type: 'text' },
      diagnosis: { type: 'object', enabled: true },
      jira_ticket_id: { type: 'keyword' },
      affected: { type: 'object', enabled: true },
      failure_rate: { type: 'object', enabled: true },
    },
  };

  await ensureIndex(client, 'transactions', transactionMappings);
  await ensureIndex(client, 'incidents', incidentMappings);

  const batchSize = 500;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    await bulkIndex(client, 'transactions', batch);
    console.log(`Indexed ${Math.min(i + batchSize, transactions.length)} / ${transactions.length}`);
  }

  const lastHour = transactions.filter(
    (t) => new Date(t.timestamp) >= hoursAgo(1)
  );
  const upiRazorpay = lastHour.filter(
    (t) => t.payment_method === 'UPI' && t.gateway === 'Razorpay'
  );
  const hdfcCards = lastHour.filter(
    (t) => t.payment_method === 'card' && t.bank === 'HDFC'
  );
  const upiRazorpayFailures = upiRazorpay.filter((t) => t.status === 'failed');
  const hdfcFailures = hdfcCards.filter((t) => t.status === 'failed');

  console.log('\nSeed complete.');
  console.log(`Total transactions: ${transactions.length}`);
  console.log(`Last hour: ${lastHour.length} transactions`);
  console.log(
    `UPI+Razorpay last hour failure rate: ${(
      (upiRazorpayFailures.length / upiRazorpay.length) *
      100
    ).toFixed(1)}%`
  );
  console.log(
    `HDFC card last hour failure rate: ${(
      (hdfcFailures.length / hdfcCards.length) *
      100
    ).toFixed(1)}%`
  );
  console.log(
    `UPI+Razorpay gateway_auth failures: ${upiRazorpayFailures.filter((t) => t.failure_stage === 'gateway_auth').length}/${upiRazorpayFailures.length}`
  );
  console.log(
    `HDFC BANK_DECLINED failures: ${hdfcFailures.filter((t) => t.error_code === 'BANK_DECLINED').length}/${hdfcFailures.length}`
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  seed().catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
}
