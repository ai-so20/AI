import fs from 'node:fs';

const cssPath = 'app/globals.css';
let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* V56 admin hero overview alignment */';
if (!css.includes(marker)) {
  css += `

${marker}
/* Give the admin summary enough room so financial values stay on one line. */
@media(min-width:1101px){
  .ai-v51-admin-hero{
    grid-template-columns:minmax(360px,.9fr) minmax(560px,1.1fr)!important;
    gap:54px!important;
    align-items:center!important;
  }
  .ai-v51-admin-overview{
    width:100%!important;
    min-width:560px!important;
    grid-template-columns:.72fr 1.18fr 1.35fr!important;
    align-self:center!important;
  }
  .ai-v51-admin-overview>div{
    min-width:0!important;
    min-height:124px!important;
    padding:21px 20px 19px!important;
    display:flex!important;
    flex-wrap:wrap!important;
    align-content:center!important;
    align-items:baseline!important;
  }
  .ai-v51-admin-overview>div:first-child{padding-left:0!important}
  .ai-v51-admin-overview span{
    flex:0 0 100%!important;
    margin-bottom:8px!important;
    font-size:10px!important;
    line-height:1.2!important;
    letter-spacing:-.1px!important;
    white-space:nowrap!important;
  }
  .ai-v51-admin-overview strong{
    display:block!important;
    max-width:100%!important;
    margin-top:0!important;
    font-size:21px!important;
    line-height:1.18!important;
    letter-spacing:-.65px!important;
    white-space:nowrap!important;
    word-break:keep-all!important;
    font-variant-numeric:tabular-nums!important;
  }
  .ai-v51-admin-overview small{
    margin-left:4px!important;
    font-size:9px!important;
    white-space:nowrap!important;
  }
}
@media(min-width:1101px) and (max-width:1280px){
  .ai-v51-admin-hero{grid-template-columns:minmax(310px,.82fr) minmax(540px,1.18fr)!important;gap:38px!important;padding-left:38px!important;padding-right:38px!important}
  .ai-v51-admin-overview{min-width:540px!important}
  .ai-v51-admin-overview>div{padding-left:15px!important;padding-right:15px!important}
  .ai-v51-admin-overview strong{font-size:19px!important}
}
`;
  fs.writeFileSync(cssPath, css);
}
