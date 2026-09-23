// 书第8章 —— 字符串池（intern）：同名字面量共享同一个堆中 String 对象
import { newArray } from './array.js';

const internedStrings = new Map(); // JS 字符串 → 堆中 String 对象

// JS 字符串 → 堆中 java/lang/String 对象（驻留）
export function jString(loader, jsStr) {
  if (internedStrings.has(jsStr)) return internedStrings.get(jsStr);

  // String 对象内部是 char[]：先造 char 数组并填充
  const charArrClass = loader.loadClass('[C');
  const charArr = newArray(charArrClass, jsStr.length);
  for (let i = 0; i < jsStr.length; i++) {
    charArr.data[i] = jsStr.charCodeAt(i);
  }
  const strClass = loader.loadClass('java/lang/String');
  const jStr = strClass.newObject();
  jStr.setRefVar('value', '[C', charArr); // 直接塞字段，不走构造器
  internedStrings.set(jsStr, jStr);
  return jStr;
}

// 堆中 String 对象 → JS 字符串
export function jsString(jStr) {
  const charArr = jStr.getRefVar('value', '[C');
  return String.fromCharCode(...charArr.data);
}
