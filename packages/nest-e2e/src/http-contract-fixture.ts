// SPDX-License-Identifier: MIT
// Original consumer-owned conformance code, never a generator template or a
// canonical application API. The same controllers and assertions run everywhere.
export const httpContractFixture = String.raw`
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createServer, type AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import {
  Body, Controller, Cookies, Get, Header, Headers, HttpCode, HttpException,
  Injectable, Module, Param, Post, Query, RawBody, Redirect, Req, Res,
  SerializeOptions, SignedCookies, StandardSchemaSerializerInterceptor,
  StandardSchemaValidationPipe, StreamableFile, UnauthorizedException,
  UseGuards, UseInterceptors, UsePipes,
  type CanActivate, type ExecutionContext,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { AppModule } from './app.module.js';
import { UsersService } from './users/users.service.js';
import { createContractApp, platform } from './contract-bootstrap.js';

type Person = { name: string };
let handlerCalls = 0;
let validations = 0;
const personSchema: StandardSchemaV1<unknown, Person> = {
  '~standard': {
    version: 1, vendor: 'http-conformance-fixture',
    async validate(value) {
      validations++;
      if (typeof value !== 'object' || value === null || !('name' in value) ||
          typeof value.name !== 'string' || !value.name.trim())
        return { issues: [{ message: 'name is required', path: ['name'] }] };
      return { value: { name: value.name.trim() } };
    },
  },
};
const positiveInteger: StandardSchemaV1<unknown, number> = {
  '~standard': {
    version: 1, vendor: 'http-conformance-fixture',
    validate(value) {
      const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
      return Number.isSafeInteger(number) && number > 0 ? { value: number }
        : { issues: [{ message: 'positive integer required' }] };
    },
  },
};
const lifecycle: string[] = [];
@Injectable()
class Lifecycle {
  onModuleInit() { lifecycle.push('init'); }
  onApplicationBootstrap() { lifecycle.push('bootstrap'); }
  onModuleDestroy() { lifecycle.push('destroy'); }
  beforeApplicationShutdown() { lifecycle.push('beforeShutdown'); }
  onApplicationShutdown() { lifecycle.push('shutdown'); }
}
// A small deterministic boundary fixture, not a session or policy product.
@Injectable()
class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>; params: { tenant: string };
    }>();
    if (request.headers.authorization !== 'Bearer fixture-reader')
      throw new UnauthorizedException();
    return request.params.tenant === 'allowed';
  }
}

@Controller('contract')
@UsePipes(new StandardSchemaValidationPipe())
@UseInterceptors(StandardSchemaSerializerInterceptor)
class ContractController {
  constructor(private readonly users: UsersService, private readonly adapters: HttpAdapterHost) {}

  @Post()
  @SerializeOptions({ schema: personSchema })
  create(@Body({ schema: personSchema }) body: Person) {
    handlerCalls++;
    assert.deepEqual(Object.keys(body), ['name']);
    assert.equal(body.name, body.name.trim(), 'validation must transform handler input');
    assert.equal(this.users.create(body), 'This action adds a new user');
    return { name: body.name, secret: 'serialization must remove this' };
  }
  @Post('guard/:tenant')
  @UseGuards(TenantGuard)
  guarded(@Body({ schema: personSchema }) body: Person) {
    handlerCalls++;
    return body;
  }
  @Get('item/:id')
  item(@Param('id', { schema: positiveInteger }) id: number,
       @Query('page', { schema: positiveInteger }) page: number) {
    return { id, page, types: [typeof id, typeof page] };
  }
  @Get('query')
  query(@Query() value: Record<string, unknown>) { return value; }
  @Post('form')
  form(@Body() value: unknown) { return value; }
  @Get('invalid-response')
  @SerializeOptions({ schema: personSchema })
  invalidResponse() { return { secret: 'invalid response must not escape' }; }
  @Get('conflict')
  conflict() { throw new HttpException({ code: 'CONFLICT', statusCode: 409 }, 409); }
  @Get('crash')
  crash() { throw new Error('private exception detail'); }
  @Get('header')
  @Header('x-contract', '612')
  header() { return 'header'; }
  @Get('redirect')
  @Redirect('/contract/header', 307)
  redirect() { return undefined; }
  @Get('stream')
  stream() {
    return new StreamableFile(Readable.from([Buffer.from('first\n'), Buffer.from('second\n')]),
      { type: 'text/plain', disposition: 'inline' });
  }
  @Get('cookies')
  cookies(@Res({ passthrough: true }) response: unknown) {
    const adapter = this.adapters.httpAdapter;
    adapter.setCookie(response, 'plain', 'hello world', { path: '/', httpOnly: true, sameSite: 'strict', secure: true, maxAge: 60 });
    adapter.setCookie(response, 'signed', 'trusted', { path: '/', httpOnly: true, sameSite: 'strict', secure: true, signed: true });
    return { ok: true };
  }
  @Get('read-cookies')
  readCookies(@Cookies('plain') plain: string | undefined, @SignedCookies('signed') signed: string | undefined) {
    return { plain: plain ?? null, signed: signed ?? null };
  }
  @Get('clear-cookie')
  clearCookie(@Res({ passthrough: true }) response: unknown) {
    this.adapters.httpAdapter.clearCookie(response, 'plain', { path: '/', httpOnly: true, secure: true, sameSite: 'strict' });
    return { ok: true };
  }
  @Post('webhook')
  @HttpCode(200)
  webhook(@RawBody() raw: Buffer | undefined, @Headers('x-signature') signature = '') {
    const expected = createHmac('sha256', 'fixture-webhook-secret').update(raw ?? '').digest('hex');
    if (!raw || !/^[a-f0-9]{64}$/.test(signature) ||
        !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex')))
      throw new UnauthorizedException();
    return { bytes: raw.toString('base64') };
  }
  @Get('proxy')
  proxy(@Req() request: { ip: string; protocol: string; hostname: string }) {
    return { ip: request.ip, protocol: request.protocol, hostname: request.hostname };
  }
}
@Module({ imports: [AppModule], controllers: [ContractController], providers: [UsersService, TenantGuard, Lifecycle] })
class ContractModule {}

type Reply = { status: number; headers: import('node:http').IncomingHttpHeaders; text: string };
function request(url: string, path: string, options: {
  method?: string; headers?: Record<string, string>; body?: string; ca?: Buffer;
} = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const secure = url.startsWith('https:');
    const req = (secure ? httpsRequest : httpRequest)(new URL(path, url), {
      method: options.method ?? 'GET', headers: { connection: 'close', ...options.headers },
      agent: false, ...(secure ? { ca: options.ca, servername: 'localhost' } : {}),
    }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(Buffer.from(chunk)));
      response.once('error', reject);
      response.once('end', () => resolve({ status: response.statusCode!, headers: response.headers, text: Buffer.concat(chunks).toString() }));
    });
    req.setTimeout(5_000, () => req.destroy(new Error('HTTP contract request timed out')));
    req.once('error', reject);
    req.end(options.body);
  });
}
function securityHeaders(reply: Reply) {
  assert.equal(reply.headers['x-content-type-options'], 'nosniff');
  assert.equal(reply.headers['x-frame-options'], 'SAMEORIGIN');
  assert.equal(reply.headers['x-powered-by'], undefined);
  assert.match(String(reply.headers['content-security-policy']), /default-src 'self'/);
}
async function commonContract(url: string, ca?: Buffer) {
  const call = (path: string, options: Parameters<typeof request>[2] = {}) => request(url, path, { ca, ...options });
  const post = (path: string, body: string, headers: Record<string, string> = {}) => call(path,
    { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers } });
  let reply = await post('/contract', JSON.stringify({ name: '  Ada  ', secret: 'input only' }));
  assert.equal(reply.status, 201); assert.deepEqual(JSON.parse(reply.text), { name: 'Ada' }); securityHeaders(reply);
  const calls = handlerCalls;
  reply = await post('/contract', '{"name":123}');
  assert.equal(reply.status, 400); assert.deepEqual(JSON.parse(reply.text).message, ['name: name is required']);
  assert.equal(handlerCalls, calls, 'invalid input must not reach the handler');
  reply = await call('/contract/item/7?page=2');
  assert.equal(reply.status, 200); assert.deepEqual(JSON.parse(reply.text), { id: 7, page: 2, types: ['number', 'number'] });
  assert.equal((await call('/contract/item/nope?page=2')).status, 400);
  assert.equal((await call('/contract/item/7?page=nope')).status, 400);
  assert.equal((await call('/contract/item/7?page=1&page=2')).status, 400);
  reply = await call('/contract/invalid-response');
  assert.equal(reply.status, 500); assert.ok(!reply.text.includes('secret'));

  const beforeGuard = validations;
  assert.equal((await post('/contract/guard/allowed', '{"name":123}')).status, 401);
  assert.equal((await post('/contract/guard/denied', '{"name":123}', { authorization: 'Bearer fixture-reader' })).status, 403);
  assert.equal(validations, beforeGuard, 'guard denial must precede validation');
  assert.equal(handlerCalls, calls);
  assert.equal((await post('/contract/guard/allowed', '{"name":"Ada"}', { authorization: 'Bearer fixture-reader' })).status, 201);

  for (const [path, status] of [['/contract/conflict', 409], ['/contract/crash', 500], ['/missing', 404]] as const) {
    reply = await call(path); assert.equal(reply.status, status); securityHeaders(reply);
    assert.ok(!reply.text.includes('private exception detail'));
  }
  assert.equal(JSON.parse((await call('/contract/conflict')).text).code, 'CONFLICT');
  assert.equal((await call('/users')).text, 'This action returns all users');
  assert.equal((await call('/users/7')).text, 'This action returns a #7 user');
  assert.equal((await post('/users', '{}')).status, 201);
  assert.equal((await call('/users/7', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 200);
  assert.equal((await call('/users/7', { method: 'DELETE' })).status, 200);

  reply = await call('/contract/header'); assert.equal(reply.headers['x-contract'], '612');
  reply = await call('/contract/header', { method: 'HEAD' });
  assert.equal(reply.status, 200); assert.equal(reply.text, ''); assert.equal(reply.headers['x-contract'], '612');
  reply = await call('/contract/redirect'); assert.equal(reply.status, 307); assert.equal(reply.headers.location, '/contract/header');
  reply = await call('/contract/stream'); assert.equal(reply.status, 200); assert.equal(reply.text, 'first\nsecond\n');
  assert.match(String(reply.headers['content-type']), /^text\/plain/);

  assert.equal((await post('/contract', '{"name":')).status, 400);
  assert.equal((await post('/contract', JSON.stringify({ name: 'x'.repeat(600) }))).status, 413);
  reply = await post('/contract', '{"name":"Ada","__proto__":{"polluted":true}}');
  // Native Node/Fastify reject poisoned JSON; Express parses it and the common
  // Standard Schema pipe removes prototype keys before invoking the schema.
  assert.equal(reply.status, platform === 'express' ? 201 : 400);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  if (reply.status === 201) assert.deepEqual(JSON.parse(reply.text), { name: 'Ada' });
  reply = await call('/contract/query?tag=a&tag=b&nested%5Bkey%5D=value');
  assert.deepEqual(JSON.parse(reply.text), { tag: ['a', 'b'], 'nested[key]': 'value' });
  reply = await call('/contract/form', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=Ada&tag=a&tag=b' });
  assert.equal(reply.status, 201); assert.deepEqual(JSON.parse(reply.text), { name: 'Ada', tag: ['a', 'b'] });
  assert.equal((await call('/contract/form', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=' + 'x'.repeat(600) })).status, 413);
  const unsupported = await post('/contract', 'opaque', { 'content-type': 'application/octet-stream' });
  assert.equal(unsupported.status, platform === 'fastify' ? 415 : 400);

  const raw = ' { "name" : "Ada" }\n';
  const signature = createHmac('sha256', 'fixture-webhook-secret').update(raw).digest('hex');
  reply = await post('/contract/webhook', raw, { 'x-signature': signature });
  assert.equal(reply.status, 200); assert.deepEqual(JSON.parse(reply.text), { bytes: Buffer.from(raw).toString('base64') });
  assert.equal((await post('/contract/webhook', raw.trim(), { 'x-signature': signature })).status, 401);
  assert.equal((await post('/contract/webhook', raw)).status, 401);
  assert.equal((await post('/contract/webhook', raw, { 'x-signature': 'bad' })).status, 401);

  reply = await call('/contract/cookies'); const cookies = reply.headers['set-cookie']!;
  assert.equal(cookies.length, 2);
  for (const cookie of cookies) { assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Path=\//); }
  assert.match(cookies[0], /Max-Age=60/);
  const cookie = cookies.map(value => value.split(';')[0]).join('; ');
  assert.deepEqual(JSON.parse((await call('/contract/read-cookies', { headers: { cookie } })).text), { plain: 'hello world', signed: 'trusted' });
  assert.equal(JSON.parse((await call('/contract/read-cookies', { headers: { cookie: cookie + 'tamper' } })).text).signed, null);
  assert.equal(JSON.parse((await call('/contract/read-cookies', { headers: { cookie: 'signed=trusted' } })).text).signed, null);
  reply = await call('/contract/clear-cookie'); assert.match(reply.headers['set-cookie']![0], /Expires=Thu, 01 Jan 1970/);

  const beforeCsrf = handlerCalls;
  reply = await post('/contract', '{"name":"Ada"}', { origin: 'https://attacker.invalid', 'sec-fetch-site': 'cross-site' });
  assert.equal(reply.status, 403); securityHeaders(reply);
  assert.equal((await post('/contract', '{"name":"Ada"}', { origin: 'https://attacker.invalid', 'x-forwarded-host': 'attacker.invalid' })).status, 403);
  assert.equal(handlerCalls, beforeCsrf);
  assert.equal((await post('/contract', '{"name":"Ada"}', { origin: url })).status, 201);
  assert.equal((await post('/contract', '{"name":"Ada"}', { origin: 'https://trusted.invalid', 'sec-fetch-site': 'cross-site' })).status, 201);
  reply = await call('/contract/header', { headers: { origin: 'https://trusted.invalid' } });
  assert.equal(reply.headers['access-control-allow-origin'], 'https://trusted.invalid');
  reply = await call('/contract/header', { headers: { origin: 'https://attacker.invalid' } });
  assert.equal(reply.headers['access-control-allow-origin'], undefined);
  reply = await call('/contract', { method: 'OPTIONS', headers: { origin: 'https://trusted.invalid', 'access-control-request-method': 'POST' } });
  assert.equal(reply.status, 204); assert.equal(reply.headers['access-control-allow-origin'], 'https://trusted.invalid');
}

async function main() {
  const tls = { key: readFileSync('contract-key.pem'), cert: readFileSync('contract-cert.pem') };
  for (const mode of ['direct', 'trusted', 'untrusted', 'https'] as const) {
    lifecycle.length = 0;
    const trust = mode === 'trusted' ? 'loopback' : mode === 'untrusted' ? '192.0.2.0/24' : false;
    const app = await createContractApp(ContractModule, trust, mode === 'https' ? tls : undefined);
    let port: number | undefined;
    try {
      assert.equal(app.getHttpAdapter().getType(), platform);
      app.useSecurityHeaders();
      app.enableCsrfProtection({ trustedOrigins: ['https://trusted.invalid'] });
      app.enableCors({ origin: ['https://trusted.invalid'] });
      await app.listen(0, '127.0.0.1');
      port = (app.getHttpServer().address() as AddressInfo).port;
      const url = (mode === 'https' ? 'https' : 'http') + '://127.0.0.1:' + port;
      const ca = mode === 'https' ? tls.cert : undefined;
      assert.deepEqual(lifecycle, ['init', 'bootstrap']);
      if (mode === 'direct' || mode === 'https') await commonContract(url, ca);
      if (mode === 'https') {
        await assert.rejects(request(url, '/contract/header'), /self-signed certificate|unable to verify/);
        assert.match(String((await request(url, '/contract/header', { ca })).headers['strict-transport-security']), /max-age=/);
      }
      const reply = await request(url, '/contract/proxy', { ca, headers: {
        'x-forwarded-for': '198.51.100.17', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'spoof.invalid',
      } });
      const proxy = JSON.parse(reply.text);
      if (mode === 'trusted') assert.deepEqual(proxy, { ip: '198.51.100.17', protocol: 'https', hostname: 'spoof.invalid' });
      else {
        assert.match(proxy.ip, /127\.0\.0\.1$/);
        assert.equal(proxy.protocol, mode === 'https' ? 'https' : 'http');
        assert.equal(proxy.hostname, '127.0.0.1');
      }
    } finally {
      await app.close();
    }
    assert.deepEqual(lifecycle, ['init', 'bootstrap', 'destroy', 'beforeShutdown', 'shutdown']);
    if (port !== undefined) await new Promise<void>((resolve, reject) => {
      const probe = createServer(); probe.once('error', reject);
      probe.listen(port, '127.0.0.1', () => probe.close(error => error ? reject(error) : resolve()));
    });
    console.log('HTTP_CONTRACT_MODE_OK ' + JSON.stringify({ platform, mode }));
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
`;
