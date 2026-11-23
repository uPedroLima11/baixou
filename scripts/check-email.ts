import nodemailer from 'nodemailer';
// Runs through `vercel env run -e production`; never logs credentials or recipients.
const {SMTP_HOST,SMTP_USER,SMTP_PASS,SMTP_FROM}=process.env;
if(!SMTP_HOST||!SMTP_USER||!SMTP_PASS)throw Error('SMTP incompleto no ambiente selecionado');
const transport=nodemailer.createTransport({host:SMTP_HOST,port:465,secure:true,auth:{user:SMTP_USER,pass:SMTP_PASS},connectionTimeout:10000,socketTimeout:15000});
await transport.verify();console.log('SMTP autenticado e conexão TLS validada.');
if(process.argv.includes('--send-owner')){
 const result=await transport.sendMail({from:SMTP_FROM||SMTP_USER,to:SMTP_USER,subject:'Baixou! — verificação de e-mail',text:'Esta mensagem valida o envio pelo Nodemailer do Baixou!. Nenhuma senha ou credencial está incluída. O recebimento deve ser confirmado pelo proprietário.'});
 console.log(result.accepted.length===1?'Mensagem de teste aceita pelo SMTP; recebimento ainda depende de confirmação.':'Mensagem não aceita.');
}
transport.close();
