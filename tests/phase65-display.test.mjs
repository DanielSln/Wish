import test from 'node:test';
import assert from 'node:assert/strict';
import { commercialDisplay } from '../src/domain/commercial-display.ts';
import { money } from '../src/domain/product.ts';
test('headline uses only the explicit selected marker matching the saved amount',()=>{
 const input='À vista no PIX: R$399,99\nPreço selecionado: '+money(39999)+' — À vista no PIX.\nOrigem: https://loja.example/p?gclid=fixture\nConsulta: 2026-11-21T00:00:00Z';
 const result=commercialDisplay(input,39999);assert.equal(result.condition,'À vista no PIX');assert.equal(result.text,'À vista no PIX: R$399,99');assert.equal(commercialDisplay(input,49999).condition,'');assert.match(input,/Origem:/);
});
test('free-form PIX/coupon and matching numbers never invent a headline condition',()=>{
 assert.equal(commercialDisplay('PIX e cupom TESTE15 — confirmar',10000).condition,'');assert.equal(commercialDisplay('Valor 100,00',10000).condition,'');assert.equal(commercialDisplay('',null).condition,'');
});
test('manual price adjustment remains explicit without relabeling the new amount as PIX',()=>{
 const input='Preço selecionado: '+money(7000)+' — À vista no PIX + cupom TESTE15.\nPreço ajustado manualmente no cadastro: '+money(6500)+'. Condições preservadas.';
 assert.equal(commercialDisplay(input,6500).condition,'Preço ajustado manualmente');assert.match(input,/70,00/);assert.match(input,/65,00/);
});
test('coupon identifier and payment remain visible, detailed requirements stay in the disclosure',()=>{
 const input='Cupom anunciado: TESTE15. Compra mínima R$500,00.\nPreço selecionado: '+money(35000)+' — À vista no PIX + cupom TESTE15 — Compra mínima R$500,00.';
 const result=commercialDisplay(input,35000);assert.match(result.condition,/À vista no PIX \+ cupom TESTE15/);assert.match(result.condition,/Compra mínima R\$500,00/);assert.match(result.text,/Compra mínima/);
});
test('display removes technical provenance and URL tokens without mutating stored conditions',()=>{
 const input='Cupom TESTE válido para o modelo azul; consulte https://loja.example/p?seller_id=1\nDisponibilidade limitada.\nOrigem: https://loja.example/p\nConsulta: data';const result=commercialDisplay(input,null);assert.doesNotMatch(result.text,/https:|Origem:|Consulta:/);assert.match(result.text,/modelo azul/);assert.match(result.text,/Disponibilidade/);assert.match(input,/seller_id=1/);
});
test('ordinary marker and no condition do not create redundant empty commercial sections',()=>{
 assert.deepEqual(commercialDisplay('Preço selecionado: '+money(9999)+' — Preço informado pela loja.\nOrigem: https://loja.example/p\nConsulta: data',9999),{condition:'',text:''});
});

test('missing-price placeholders do not create an empty commercial disclosure',()=>{assert.equal(commercialDisplay('Preço não confirmado.\nOrigem: https://loja.example/p',null).text,'');});
