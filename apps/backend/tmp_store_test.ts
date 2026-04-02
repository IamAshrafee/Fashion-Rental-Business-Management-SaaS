import { PathaoAdapter } from './src/modules/fulfillment/providers/pathao.adapter';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';

async function run() {
  const httpService = new HttpService(axios.create());
  const adapter = new PathaoAdapter(httpService);

  const config = {
    enabled: true,
    clientId: '7N1aMJQbWm',
    clientSecret: 'wRcaibZkUdSNz2EI9ZyuXLlNrnAv0TdPUPXMnD39',
    username: 'test@pathao.com',
    password: 'lovePathao',
    defaultStoreId: 9999999, // INVALID
    sandbox: true,
  };

  const params = {
    merchantOrderId: "T-STORE",
    recipientName: "Test",
    recipientPhone: "01700000001",
    recipientAddress: "Dhaka",
    recipientCity: "Dhaka",
    codAmount: 0
  };

  try {
    await adapter.createParcel(params as any, config);
  } catch (e: any) {
    console.log("CAUGHT ERROR MSG:", e.message);
  }
}

run().catch(console.error);
