import nodemailer from 'nodemailer';
export async function checkEmail(sendOwner=false){
 const {SMTP_HOST,SMTP_USER,SMTP_PASS,SMTP_FROM}=process.env;
 if(!SMTP_HOST||!SMTP_USER||!SMTP_PASS)return {configured:false,verified:false};
 const port=Number(process.env.SMTP_PORT)||465;
 const transport=nodemailer.createTransport({host:SMTP_HOST,port,secure:port===465,auth:{user:SMTP_USER,pass:SMTP_PASS},connectionTimeout:10000,socketTimeout:15000});
 try{await transport.verify();if(sendOwner){const result=await transport.sendMail({from:SMTP_FROM||SMTP_USER,to:SMTP_USER,subject:'Baixou! — verificação de e-mail',text:'Teste do Nodemailer do Baixou!. Confirme o recebimento para concluir a validação. Nenhuma senha ou credencial está incluída.'});return {configured:true,verified:true,accepted:result.accepted.length===1};}return {configured:true,verified:true};}finally{transport.close();}
}
