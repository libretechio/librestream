import {defineTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';
export const librestreamTheme=defineTheme({
 name:'librestream',
 extends:neutralTheme,
 typography:{
  body:{family:'Figtree Variable',fallbacks:['system-ui','sans-serif']},
  heading:{family:'Figtree Variable',fallbacks:['system-ui','sans-serif']},
  code:{family:'monospace'}
 }
});
