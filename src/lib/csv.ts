export function csvCell(value:unknown){
 let text=String(value??"");
 // Quoting alone does not prevent spreadsheet formula injection.
 if(/^\s*[=+@-]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
