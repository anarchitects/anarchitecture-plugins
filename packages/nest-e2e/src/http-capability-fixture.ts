// SPDX-License-Identifier: MIT
// Consumer-owned evidence, not generated templates or canonical API contracts.
export const httpCapabilityFixture = String.raw`
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  Body, Controller, Get, Module, Post, Render, UploadedFile, UseInterceptors,
  UsePipes, ParseFilePipe, StandardSchemaValidationPipe,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiBadRequestResponse, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { StandardSchemaV1, StandardJSONSchemaV1 } from '@standard-schema/spec';
import { AppModule } from './app.module.js';
import { createCapabilityApp, FileInterceptor, platform } from './capability-bootstrap.js';

type Person = { name: string };
const jsonSchema = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false };
const validationOnly: StandardSchemaV1<unknown, Person> = {
  '~standard': { version: 1, vendor: 'capability-fixture', validate(value) {
    if (!value || typeof value !== 'object' || !('name' in value) || typeof value.name !== 'string' || !value.name.trim())
      return { issues: [{ message: 'name is required', path: ['name'] }] };
    return { value: { name: value.name.trim() } };
  } },
};
const personSchema: StandardSchemaV1<unknown, Person> & StandardJSONSchemaV1 = {
  '~standard': { ...validationOnly['~standard'], jsonSchema: {
    input: () => jsonSchema, output: () => jsonSchema,
  } },
};
let uploadCalls = 0;
@Controller('capabilities')
@UsePipes(new StandardSchemaValidationPipe())
class CapabilityController {
  @Post('person')
  @ApiOperation({ operationId: 'createPerson' })
  @ApiCreatedResponse({ standardSchema: personSchema })
  @ApiBadRequestResponse({ description: 'Invalid person' })
  person(@Body({ schema: personSchema }) body: Person) { return body; }

  @Post('converted')
  @ApiOperation({ operationId: 'convertPerson' })
  @ApiCreatedResponse({ standardSchema: validationOnly })
  converted(@Body({ schema: validationOnly }) body: Person) { return body; }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 64, files: 1, fields: 1, fieldSize: 16, parts: 3 } }))
  upload(@UploadedFile(new ParseFilePipe()) file: { originalname: string; size: number; buffer: Buffer; path?: string }) {
    uploadCalls++;
    assert.equal(file.path, undefined, 'memory-only fixture must not persist client filenames');
    return { name: file.originalname, size: file.size, text: file.buffer.toString('utf8') };
  }

  @Get('view')
  @Render('hello.ejs')
  view() { return { message: '<script>alert(1)</script>' }; }
}
@Module({ imports: [AppModule], controllers: [CapabilityController] })
class CapabilityModule {}

async function main() {
  const enabled = process.argv[2] === 'enabled';
  const app = await createCapabilityApp(enabled ? CapabilityModule : AppModule, enabled);
  try {
    assert.equal(app.getHttpAdapter().getType(), platform);
    if (enabled) {
      const config = new DocumentBuilder().setTitle('Capability evidence').setVersion('1').build();
      const automatic = SwaggerModule.createDocument(app, config);
      const person = automatic.paths['/capabilities/person'].post!;
      assert.equal(person.operationId, 'createPerson');
      assert.deepEqual((person.requestBody as any).content['application/json'].schema, jsonSchema);
      assert.deepEqual((person.responses['201'] as any).content['application/json'].schema, jsonSchema);
      assert.equal((person.responses['400'] as any).description, 'Invalid person');
      // Successful validation alone does not guarantee a usable OpenAPI schema.
      assert.notDeepEqual((automatic.paths['/capabilities/converted'].post!.responses['201'] as any).content?.['application/json']?.schema, jsonSchema);
      const converted: string[] = [];
      const document = SwaggerModule.createDocument(app, config, {
        standardSchemaConverter(schema, options) {
          if (schema !== validationOnly) return undefined;
          converted.push(options.schemaType);
          return { schema: jsonSchema };
        },
      });
      assert.ok(converted.includes('input') && converted.includes('output'));
      const operation = document.paths['/capabilities/converted'].post!;
      assert.deepEqual((operation.requestBody as any).content['application/json'].schema, jsonSchema);
      assert.deepEqual((operation.responses['201'] as any).content['application/json'].schema, jsonSchema);
      SwaggerModule.setup('docs', app, document);
    }
    await app.listen(0, '127.0.0.1');
    const port = (app.getHttpServer().address() as AddressInfo).port;
    async function send(path: string, method = 'GET', body?: string, headers: Record<string, string> = {}) {
      return new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; body: string }>((resolve, reject) => {
        const req = request({ hostname: '127.0.0.1', port, path, method, headers }, res => {
          const chunks: Buffer[] = [];
          res.on('data', chunk => chunks.push(Buffer.from(chunk)));
          res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks).toString() }));
          res.on('error', reject);
        });
        req.setTimeout(5000, () => req.destroy(new Error('capability request timeout')));
        req.on('error', reject); req.end(body);
      });
    }
    assert.equal((await send('/')).body, 'Hello World!');
    if (!enabled) {
      for (const path of ['/docs', '/docs-json', '/assets/hello.txt', '/capabilities/view'])
        assert.equal((await send(path)).status, 404, path);
      assert.equal((await send('/capabilities/upload', 'POST')).status, 404);
    } else {
      const document = await send('/docs-json');
      assert.equal(document.status, 200);
      assert.match(String(document.headers['content-type']), /json/);
      assert.equal(JSON.parse(document.body).paths['/capabilities/person'].post.operationId, 'createPerson');
      for (const [path, content] of [['/docs/', /swagger-ui/], ['/docs/swagger-ui.css', /swagger-ui/], ['/docs/swagger-ui-bundle.js', /SwaggerUIBundle/]] as const) {
        const response = await send(path);
        assert.equal(response.status, 200, path); assert.match(response.body, content);
      }
      const valid = await send('/capabilities/person', 'POST', JSON.stringify({ name: ' Ada ', secret: true }), { 'content-type': 'application/json' });
      assert.equal(valid.status, 201); assert.deepEqual(JSON.parse(valid.body), { name: 'Ada' });
      assert.equal((await send('/capabilities/person', 'POST', '{}', { 'content-type': 'application/json' })).status, 400);
      const asset = await send('/assets/hello.txt');
      assert.equal(asset.status, 200); assert.equal(asset.body, 'public capability asset');
      assert.match(String(asset.headers['content-type']), /text\/plain/);
      const head = await send('/assets/hello.txt', 'HEAD');
      assert.equal(head.status, 200); assert.equal(head.body, '');
      for (const path of ['/assets/missing.txt', '/assets/.secret', '/assets/%2e%2e/private.txt', '/assets/..%2fprivate.txt']) {
        const response = await send(path);
        assert.ok([400, 403, 404].includes(response.status), path + ': ' + response.status);
        assert.ok(!response.body.includes('private capability sentinel'));
      }
      const view = await send('/capabilities/view');
      assert.equal(view.status, 200); assert.match(String(view.headers['content-type']), /html/);
      assert.ok(view.body.includes('&lt;script&gt;')); assert.ok(!view.body.includes('<script>'));

      const boundary = 'capability-evidence-boundary';
      const file = (name: string, contents: string, field = 'file') => '--' + boundary + '\r\nContent-Disposition: form-data; name="' + field + '"; filename="' + name + '"\r\nContent-Type: text/plain\r\n\r\n' + contents + '\r\n';
      const field = (name: string, contents: string) => '--' + boundary + '\r\nContent-Disposition: form-data; name="' + name + '"\r\n\r\n' + contents + '\r\n';
      const upload = (parts: string) => send('/capabilities/upload', 'POST', parts + '--' + boundary + '--\r\n', { 'content-type': 'multipart/form-data; boundary=' + boundary });
      const uploaded = await upload(file('../hello.txt', 'hello'));
      assert.equal(uploaded.status, 201); assert.deepEqual(JSON.parse(uploaded.body), { name: 'hello.txt', size: 5, text: 'hello' });
      const rejected = [
        ['oversized file', file('large.txt', 'x'.repeat(65)), 413],
        ['unexpected field', file('x.txt', 'x', 'other'), 400],
        ['multiple files', file('a.txt', 'a') + file('b.txt', 'b'), 400],
        ['oversized field', field('note', 'x'.repeat(17)), 400],
        ['too many fields', field('a', 'a') + field('b', 'b'), 400],
        ['missing file', field('note', 'x'), 400],
      ] as const;
      for (const [name, parts, status] of rejected) {
        const result = await upload(parts);
        assert.equal(result.status, status, name + ': ' + result.body);
      }
      const malformed = await send('/capabilities/upload', 'POST', 'invalid', { 'content-type': 'multipart/form-data' });
      assert.equal(malformed.status, 400);
      assert.equal(uploadCalls, 1, 'rejected multipart must not reach handler');
    }
    console.log('HTTP_CAPABILITY_OK ' + JSON.stringify({ platform, enabled }));
  } finally { await app.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
`;
