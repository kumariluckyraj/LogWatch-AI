class MetricsTracker{
    constructor(){
        this.totalRequests=0;
        this.successCount=0;
        this.failureCount=0;

        this.totalLatency=0;
        this.maxLatency=0;
        this.minLatency=Infinity;
        this.startTime= Date.now();
    }
recordRequest(statusCode, latency) {
    this.totalRequests++;

    if(statusCode>=400){
        this.failureCount++;
    }else{
        this.successCount++;
    }
    this.totalLatency+=latency;

    if(latency>this.maxLatency){
        this.maxLatency=latency;
    }
    if(latency<this.minLatency){
        this.minLatency=latency;
    }
}

getMetrics() {

    const uptimeMinutes= (Date.now() - this.startTime) /60000;

    const requestsPerMinute= uptimeMinutes>0 ? Number((this.totalRequests/uptimeMinutes).toFixed(2)):0;
    const successRate= this.totalRequests>0 ? Number(((this.successCount/this.totalRequests)*100).toFixed(2)):0;

    const failureRate=this.totalRequests>0 ? Number(((this.failureCount/this.totalRequests)*100).toFixed(2)):0;
  return {
    totalRequests: this.totalRequests,
    successCount: this.successCount,
    failureCount: this.failureCount,

    avgLatency:
      this.totalRequests > 0
        ? Math.round(this.totalLatency / this.totalRequests)
        : 0,

    maxLatency: this.maxLatency,

    minLatency:
      this.minLatency === Infinity
        ? 0
        : this.minLatency,
    
    successRate: successRate,
    failureRate: failureRate,
    requestsPerMinute: requestsPerMinute
  };
}
}


module.exports=MetricsTracker