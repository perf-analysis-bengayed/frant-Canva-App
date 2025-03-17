import { Injectable } from '@angular/core';

interface Media {
  name: string;
  type: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
  thumbnail?: string;
  originalDuration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MediaService {

}