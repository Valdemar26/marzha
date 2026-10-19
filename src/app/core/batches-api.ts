import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { BatchInput, SavedBatch } from '@shared/api/batches';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BatchesApi {
  private readonly http = inject(HttpClient);

  list(): Promise<SavedBatch[]> {
    return firstValueFrom(this.http.get<SavedBatch[]>('/api/batches'));
  }

  get(id: string): Promise<SavedBatch> {
    return firstValueFrom(this.http.get<SavedBatch>(`/api/batches/${id}`));
  }

  create(input: BatchInput): Promise<SavedBatch> {
    return firstValueFrom(this.http.post<SavedBatch>('/api/batches', input));
  }

  update(id: string, input: BatchInput): Promise<SavedBatch> {
    return firstValueFrom(this.http.put<SavedBatch>(`/api/batches/${id}`, input));
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/batches/${id}`));
  }
}
