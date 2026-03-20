package com.fintrack.report.controller;

import com.fintrack.report.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:4200", "${app.cors.allowed-origins:*}"})
public class ReportController {

    private final ReportService reportService;

    // ── Request report generation ─────────────────────────────────────────
    @PostMapping("/generate")
    public ResponseEntity<ReportService.ReportJob> generate(
            @RequestBody ReportService.ReportRequest request) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(reportService.requestReport(request));
    }

    // ── Check job status ──────────────────────────────────────────────────
    @GetMapping("/{jobId}/status")
    public ResponseEntity<ReportService.ReportJob> status(@PathVariable String jobId) {
        return reportService.getJob(jobId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Download report content ────────────────────────────────────────────
    @GetMapping("/{jobId}/download")
    public ResponseEntity<byte[]> download(@PathVariable String jobId) {
        return reportService.getJob(jobId)
                .filter(job -> job.getStatus() == ReportService.JobStatus.READY)
                .map(job -> {
                    byte[] bytes = job.getContent().getBytes(StandardCharsets.UTF_8);
                    return ResponseEntity.ok()
                            .header(HttpHeaders.CONTENT_DISPOSITION,
                                    "attachment; filename=\"" + job.getFileName() + "\"")
                            .contentType(MediaType.parseMediaType(job.getFormat()))
                            .contentLength(bytes.length)
                            .body(bytes);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
