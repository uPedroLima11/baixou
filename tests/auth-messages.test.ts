import {test} from 'node:test';import assert from 'node:assert/strict';
import {authErrorMessage} from '../components/Account';
test('mensagens de cadastro/login específicas (caso real de 27/11)',()=>{
 assert.match(authErrorMessage({code:'over_email_send_rate_limit',message:'For security purposes, you can only request this after 52 seconds.'},'register'),/Já enviamos o e-mail de confirmação.*52 segundos/);
 assert.match(authErrorMessage({code:'email_not_confirmed',message:'Email not confirmed'},'login'),/ainda não foi confirmado/);
 assert.match(authErrorMessage({code:'invalid_credentials',message:'Invalid login credentials'},'login'),/incorretos/);
 assert.match(authErrorMessage({code:'user_already_exists',message:'User already registered'},'register'),/Já existe uma conta/);
 assert.match(authErrorMessage(new Error('boom'),'login'),/Tente novamente/);
});
