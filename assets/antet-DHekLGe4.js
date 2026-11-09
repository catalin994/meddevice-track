const t="meditrack_referat_antet",a=()=>{try{return JSON.parse(localStorage.getItem(t)||"{}")||{}}catch{return{}}},r=e=>{try{localStorage.setItem(t,JSON.stringify(e))}catch{}};export{a,r as p};
