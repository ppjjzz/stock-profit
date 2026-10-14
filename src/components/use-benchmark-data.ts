'use client';
import { useEffect, useState } from 'react';
import type { BenchmarkResult } from '@/lib/benchmarks';

export function useBenchmarkData(start:string,end:string) {
  const [state,setState]=useState<{data:BenchmarkResult|null;error:string;key:string;pending:boolean}>({data:null,error:'',key:'',pending:true});
  const [retry,setRetry]=useState(0);
  const key=`${start}/${end}/${retry}`;
  useEffect(()=>{
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      try {
        const response=await fetch(`/api/benchmarks?start=${start}&end=${end}`,{signal:controller.signal});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||'指数行情请求失败');
        if(!controller.signal.aborted)setState({data,error:'',key,pending:false});
      } catch(error) {
        if(!controller.signal.aborted)setState({data:null,error:error instanceof Error?error.message:'指数行情请求失败',key,pending:false});
      }
    },400);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[start,end,key]);
  return {data:state.key===key?state.data:null,error:state.key===key?state.error:'',loading:state.key!==key||state.pending,reload:()=>setRetry(r=>r+1)};
}
export type BenchmarkData = ReturnType<typeof useBenchmarkData>;
