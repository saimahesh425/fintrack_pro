// src/app/features/reports/reports.component.ts
import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule }        from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient }          from '@angular/common/http';
import { interval, Subject }   from 'rxjs';
import { switchMap, takeUntil, takeWhile } from 'rxjs/operators';

interface ReportJob {
  jobId:      string;
  type:       string;
  status:     'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  fileName?:  string;
  errorMessage?: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="reports-container">
      <div class="reports-header">
        <h1>Compliance Reports</h1>
        <p>Generate AML, SAR, and activity reports for regulatory submission.</p>
      </div>

      <!-- ── Report Request Form ── -->
      <div class="report-form-card">
        <h2>Generate New Report</h2>
        <form [formGroup]="form" (ngSubmit)="generate()">
          <div class="form-row">
            <div class="form-group">
              <label>Report Type</label>
              <select formControlName="type" class="form-control">
                <option value="AML_REPORT">AML Report</option>
                <option value="SAR_REPORT">SAR Report</option>
                <option value="ACTIVITY_REPORT">Activity Report</option>
              </select>
            </div>
            <div class="form-group">
              <label>Format</label>
              <select formControlName="format" class="form-control">
                <option value="CSV">CSV</option>
                <option value="TEXT">Text</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>From</label>
              <input type="date" formControlName="from" class="form-control" />
            </div>
            <div class="form-group">
              <label>To</label>
              <input type="date" formControlName="to" class="form-control" />
            </div>
          </div>
          <button type="submit" class="btn-primary" [disabled]="form.invalid || loading">
            {{ loading ? 'Generating...' : 'Generate Report' }}
          </button>
        </form>
      </div>

      <!-- ── Active Jobs ── -->
      <div class="jobs-card" *ngIf="jobs.length > 0">
        <h2>Report Jobs</h2>
        <div class="job-list">
          <div *ngFor="let job of jobs" class="job-item">
            <div class="job-info">
              <span class="job-type">{{ job.type }}</span>
              <span class="job-id">{{ job.jobId | slice:0:8 }}...</span>
            </div>
            <div class="job-status-wrap">
              <span class="job-status" [class]="'status-' + job.status.toLowerCase()">
                {{ job.status }}
              </span>
            </div>
            <div class="job-actions">
              <button
                *ngIf="job.status === 'READY'"
                class="btn-download"
                (click)="download(job)">
                ⬇ Download
              </button>
              <span *ngIf="job.status === 'PENDING' || job.status === 'PROCESSING'"
                    class="spinner">⟳</span>
              <span *ngIf="job.status === 'FAILED'" class="error-msg">
                {{ job.errorMessage || 'Generation failed' }}
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .reports-container { padding: 24px; max-width: 900px; margin: 0 auto; }
    .reports-header { margin-bottom: 24px; }
    .reports-header h1 { font-size: 22px; font-weight: 600; color: #1a3f6b; margin: 0 0 8px; }
    .reports-header p { color: #666; font-size: 14px; margin: 0; }

    .report-form-card, .jobs-card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 24px; margin-bottom: 20px;
    }
    h2 { font-size: 16px; font-weight: 600; color: #1a3f6b; margin: 0 0 20px; }

    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 13px; font-weight: 500; color: #444; }
    .form-control {
      padding: 10px 12px; border: 1px solid #c0c8d8; border-radius: 8px;
      font-size: 14px; outline: none; transition: border-color 0.2s;
    }
    .form-control:focus { border-color: #1f5c99; }

    .btn-primary {
      padding: 11px 24px; background: #1f5c99; color: #fff; border: none;
      border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px;
      transition: background 0.2s; margin-top: 8px;
    }
    .btn-primary:hover:not(:disabled) { background: #1a3f6b; }
    .btn-primary:disabled { background: #aaa; cursor: not-allowed; }

    .job-list { display: flex; flex-direction: column; gap: 10px; }
    .job-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; border: 1px solid #e2e8f0; border-radius: 8px;
    }
    .job-info { display: flex; flex-direction: column; gap: 2px; }
    .job-type { font-weight: 600; font-size: 14px; color: #1a3f6b; }
    .job-id { font-family: monospace; font-size: 11px; color: #888; }

    .job-status { padding: 4px 10px; border-radius: 10px; font-size: 12px; font-weight: 600; }
    .status-pending    { background: #fff8e1; color: #7d4e00; }
    .status-processing { background: #e8f0fe; color: #1f5c99; }
    .status-ready      { background: #e8f5e9; color: #2d5a1b; }
    .status-failed     { background: #fce8e8; color: #a32d2d; }

    .btn-download {
      padding: 7px 14px; background: #0f6e56; color: #fff; border: none;
      border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
    }
    .spinner { font-size: 18px; animation: spin 1s linear infinite; display: inline-block; color: #1f5c99; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-msg { font-size: 12px; color: #a32d2d; }
  `]
})
export class ReportsComponent {

  form: FormGroup;
  jobs: ReportJob[] = [];
  loading = false;
  private destroy$ = new Subject<void>();

  constructor(private fb: FormBuilder, private http: HttpClient, private cdr: ChangeDetectorRef) {
    this.form = this.fb.group({
      type:   ['AML_REPORT', Validators.required],
      format: ['CSV',        Validators.required],
      from:   [''],
      to:     ['']
    });
  }

  generate() {
    if (this.form.invalid) return;
    this.loading = true;

    this.http.post<ReportJob>('/api/reports/generate', this.form.value)
      .subscribe({
        next: job => {
          this.jobs.unshift(job);
          this.loading = false;
          this.cdr.markForCheck();
          this.pollJobStatus(job.jobId);
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private pollJobStatus(jobId: string) {
    interval(2000).pipe(
      switchMap(() => this.http.get<ReportJob>(`/api/reports/${jobId}/status`)),
      takeWhile(job => job.status === 'PENDING' || job.status === 'PROCESSING', true),
      takeUntil(this.destroy$)
    ).subscribe(updated => {
      const idx = this.jobs.findIndex(j => j.jobId === updated.jobId);
      if (idx >= 0) this.jobs[idx] = updated;
      this.cdr.markForCheck();
    });
  }

  download(job: ReportJob) {
    window.open(`/api/reports/${job.jobId}/download`, '_blank');
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
}
