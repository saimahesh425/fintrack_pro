package com.fintrack.report;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.beans.factory.annotation.Value;

@SpringBootApplication
public class ReportServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(ReportServiceApplication.class, args);
    }

    @Bean
    public WebClient transactionServiceClient(
            @Value("${app.transaction-service-url:http://localhost:8081}") String baseUrl) {
        return WebClient.builder().baseUrl(baseUrl).build();
    }
}
