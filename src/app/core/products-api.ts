import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Product, ProductInput } from '@shared/api/products';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ProductsApi {
  private readonly http = inject(HttpClient);

  list(): Promise<Product[]> {
    return firstValueFrom(this.http.get<Product[]>('/api/products'));
  }

  get(id: string): Promise<Product> {
    return firstValueFrom(this.http.get<Product>(`/api/products/${id}`));
  }

  create(input: ProductInput): Promise<Product> {
    return firstValueFrom(this.http.post<Product>('/api/products', input));
  }

  update(id: string, input: ProductInput): Promise<Product> {
    return firstValueFrom(this.http.put<Product>(`/api/products/${id}`, input));
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/products/${id}`));
  }
}
