// SPDX-License-Identifier: MIT
// Consumer-owned integration code added beside untouched native-generated sources.
// This minimal Standard Schema implementation is test data, not a generator template.
export const standardSchemaFixture = String.raw`
import 'reflect-metadata';
import assert from 'node:assert/strict';
import type { AddressInfo, Server } from 'node:net';
import {
  Body, Controller, Get, Module, Param, Post, Query, SerializeOptions,
  StandardSchemaSerializerInterceptor, StandardSchemaValidationPipe,
  UseInterceptors, UsePipes,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClientProxyFactory, MessagePattern, Payload, RpcException, Transport } from '@nestjs/microservices';
import { ApiCreatedResponse, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';
import { firstValueFrom, timeout } from 'rxjs';
import { AppModule } from './app.module.js';
import { UsersService } from './users/users.service.js';
import { EventsService } from './events/events.service.js';

type Person = { name: string };
const conversions: string[] = [];
const personJson = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false };
const personSchema: StandardSchemaV1<unknown, Person> & StandardJSONSchemaV1<unknown, Person> = {
  '~standard': {
    version: 1,
    vendor: 'nest-compatibility-fixture',
    async validate(value) {
      if (typeof value !== 'object' || value === null || !('name' in value) || typeof value.name !== 'string' || !value.name.trim())
        return { issues: [{ message: 'name is required', path: ['name'] }] };
      return { value: { name: value.name.trim() } };
    },
    jsonSchema: {
      input(options) { conversions.push('input:' + options.target); return personJson; },
      output(options) { conversions.push('output:' + options.target); return personJson; },
    },
  },
};
const numberSchema: StandardSchemaV1<unknown, number> & StandardJSONSchemaV1<unknown, number> = {
  '~standard': {
    version: 1,
    vendor: 'nest-compatibility-fixture',
    validate(value) {
      const number = typeof value === 'string' && value.trim() ? Number(value) : NaN;
      return Number.isInteger(number) && number > 0 ? { value: number } : { issues: [{ message: 'positive integer required' }] };
    },
    jsonSchema: { input: () => ({type:'integer',minimum:1}), output: () => ({type:'integer',minimum:1}) },
  },
};
let httpCalls = 0;
let messageCalls = 0;

@Controller('contract')
@UsePipes(new StandardSchemaValidationPipe())
@UseInterceptors(StandardSchemaSerializerInterceptor)
class ContractController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @SerializeOptions({ schema: personSchema })
  @ApiCreatedResponse({ standardSchema: personSchema })
  create(@Body({ schema: personSchema }) value: Person) {
    httpCalls++;
    assert.equal(value.name, value.name.trim());
    assert.equal(this.users.create(value), 'This action adds a new user');
    return { name: value.name, secret: 'must be removed by serialization' };
  }

  @Get(':id')
  find(@Param('id', { schema: numberSchema }) id: number,
       @Query('page', { schema: numberSchema }) page: number) {
    return { id, page, types: [typeof id, typeof page] };
  }

  @Get('broken/response')
  @SerializeOptions({ schema: personSchema })
  broken() { return { secret: 'never expose an invalid response' }; }
}

@Controller()
class ContractMessages {
  constructor(private readonly events: EventsService) {}

  @MessagePattern('contract.create')
  @UsePipes(new StandardSchemaValidationPipe({
    exceptionFactory: issues => new RpcException({ code: 'INVALID_SCHEMA', messages: issues.map(issue => issue.message) }),
  }))
  @UseInterceptors(StandardSchemaSerializerInterceptor)
  @SerializeOptions({ schema: personSchema })
  create(@Payload({ schema: personSchema }) value: Person) {
    messageCalls++;
    assert.equal(value.name,value.name.trim());
    assert.equal(this.events.create(value), 'This action adds a new event');
    return { name: value.name, secret: 'must be removed from messages too' };
  }
}

@Module({ imports: [AppModule], controllers: [ContractController, ContractMessages], providers: [UsersService, EventsService] })
class CompatibilityModule {}

async function main() {
  const app = await NestFactory.create(CompatibilityModule, { logger: false });
  const microservice = app.connectMicroservice({ transport: Transport.TCP, options: { host: '127.0.0.1', port: 0 } });
  let client: ReturnType<typeof ClientProxyFactory.create> | undefined;
  try {
    await app.startAllMicroservices();
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    const request = (path: string, init?: RequestInit) => fetch(url + path, { ...init, signal: AbortSignal.timeout(5_000) });
    const post = (body: unknown) => request('/contract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    let response = await post({ name: '  Ada  ', secret: 'input-only' });
    assert.equal(response.status,201);
    assert.deepEqual(await response.json(),{name:'Ada'});
    response = await post({name: 123});
    assert.equal(response.status,400);
    assert.deepEqual((await response.json()).message,['name: name is required']);
    assert.equal(httpCalls,1,'invalid input must not reach the handler');
    response = await request('/contract/7?page=2');
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{id:7,page:2,types:['number','number']});
    assert.equal((await request('/contract/nope?page=2')).status,400);
    assert.equal((await request('/contract/7?page=nope')).status,400);
    assert.equal((await request('/contract/broken/response')).status,500);
    // Native generated controllers remain reachable, with their own behavior.
    assert.equal(await (await request('/users')).text(),'This action returns all users');

    const port = (microservice.unwrap<Server>().address() as AddressInfo).port;
    client = ClientProxyFactory.create({transport:Transport.TCP,options:{host:'127.0.0.1',port}});
    const message = (value:unknown) => firstValueFrom(client!.send('contract.create',value).pipe(timeout(5_000)));
    assert.deepEqual(await message({name:'  Grace  ',secret:'input-only'}),{name:'Grace'});
    await assert.rejects(message({name:false}), error => {
      assert.deepEqual(error,{code:'INVALID_SCHEMA',messages:['name is required']});
      return true;
    });
    assert.equal(messageCalls,1,'invalid payload must not reach the handler');
    assert.equal(await firstValueFrom(client.send('findAllEvents',{}).pipe(timeout(5_000))),'This action returns all events');

    const document = SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('Native compatibility').setVersion('1').build());
    const postOperation = document.paths['/contract'].post!;
    assert.ok(postOperation.requestBody && 'content' in postOperation.requestBody);
    assert.deepEqual(postOperation.requestBody.content['application/json'].schema,personJson);
    const created = postOperation.responses['201'];
    assert.ok(created && 'content' in created);
    assert.deepEqual(created.content!['application/json'].schema,personJson);
    const parameters = document.paths['/contract/{id}'].get!.parameters!;
    for(const name of ['id','page']) {
      const parameter = parameters.find(parameter => 'name' in parameter && parameter.name === name);
      assert.ok(parameter && 'schema' in parameter);
      assert.deepEqual(parameter.schema,{type:'integer',minimum:1});
    }
    assert.ok(document.paths['/users']);
    assert.ok(conversions.includes('input:openapi-3.0'));
    assert.ok(conversions.includes('output:openapi-3.0'));
    console.log('STANDARD_SCHEMA_COMPATIBILITY_OK');
  } finally {
    client?.close();
    await app.close();
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
`;
