// SPDX-License-Identifier: MIT
// Copied as .cts and .mts into an isolated installed fixture by audit.cjs.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import {
  Body,
  Controller,
  Get,
  Module,
  Post,
  SerializeOptions,
  StandardSchemaSerializerInterceptor,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NodeAdapter, type NestNodeApplication } from '@nestjs/platform-node';
import {
  ExpressAdapter,
  type NestExpressApplication,
} from '@nestjs/platform-express';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';

const schema = {
  '~standard': {
    version: 1 as const,
    vendor: 'adapter-audit',
    validate(value: unknown) {
      if (
        typeof value === 'object' &&
        value !== null &&
        'name' in value &&
        typeof value.name === 'string'
      ) {
        return { value: { name: value.name.trim() } };
      }
      return { issues: [{ message: 'name must be a string' }] };
    },
  },
};

@Controller()
class AuditController {
  @Get() hello() {
    return { hello: 'shared' };
  }

  @Post()
  @SerializeOptions({ schema })
  echo(@Body({ schema }) body: { name: string }) {
    assert.equal(body.name, body.name.trim());
    return { ...body, internal: 'must be removed' };
  }
}

@Module({ controllers: [AuditController] })
class AuditModule {}

type Application =
  | NestNodeApplication
  | NestExpressApplication
  | NestFastifyApplication;

async function probe() {
  const results: unknown[] = [];
  for (const platform of ['node', 'express', 'fastify'] as const) {
    // Separate typed calls check the public overloads instead of hiding them behind a cast.
    const app: Application =
      platform === 'node'
        ? await NestFactory.create<NestNodeApplication>(
            AuditModule,
            new NodeAdapter(),
            { logger: false }
          )
        : platform === 'express'
        ? await NestFactory.create<NestExpressApplication>(
            AuditModule,
            new ExpressAdapter(),
            { logger: false }
          )
        : await NestFactory.create<NestFastifyApplication>(
            AuditModule,
            new FastifyAdapter(),
            { logger: false }
          );
    try {
      assert.equal(app.getHttpAdapter().getType(), platform);
      await app.listen(0, '127.0.0.1');
      const response = await fetch(await app.getUrl());
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { hello: 'shared' });
    } finally {
      await app.close();
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AuditModule],
    }).compile();
    const testApp: Application =
      platform === 'node'
        ? moduleRef.createNestApplication<NestNodeApplication>(
            new NodeAdapter(),
            { logger: false }
          )
        : platform === 'express'
        ? moduleRef.createNestApplication<NestExpressApplication>(
            new ExpressAdapter(),
            { logger: false }
          )
        : moduleRef.createNestApplication<NestFastifyApplication>(
            new FastifyAdapter(),
            { logger: false }
          );
    try {
      testApp.useGlobalPipes(
        new StandardSchemaValidationPipe({ transform: true })
      );
      testApp.useGlobalInterceptors(
        new StandardSchemaSerializerInterceptor(testApp.get(Reflector))
      );
      await testApp.init();
      if (platform === 'fastify')
        await testApp.getHttpAdapter().getInstance().ready();
      assert.equal(testApp.getHttpAdapter().getType(), platform);
      await request(testApp.getHttpServer())
        .get('/')
        .expect(200, { hello: 'shared' });
      await request(testApp.getHttpServer())
        .post('/')
        .send({ name: ' Ada ' })
        .expect(201, { name: 'Ada' });
      await request(testApp.getHttpServer())
        .post('/')
        .send({ name: 42 })
        .expect(400);
    } finally {
      await testApp.close();
    }
    results.push({
      platform,
      factoryHttp: 'pass',
      testingHttp: 'pass',
      schemaValidationAndSerialization: 'pass',
      shutdown: 'pass',
    });
  }
  console.log(JSON.stringify(results));
}

void probe().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
