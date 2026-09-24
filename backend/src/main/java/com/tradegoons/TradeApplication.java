package com.tradegoons;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class TradeApplication {
  public static void main(String[] args) {
    var app = new SpringApplication(TradeApplication.class);
    if ("true".equals(System.getenv("TRADE_MIGRATE"))) {
      app.setWebApplicationType(org.springframework.boot.WebApplicationType.NONE);
      app.run(args).close();
    } else app.run(args);
  }
}
