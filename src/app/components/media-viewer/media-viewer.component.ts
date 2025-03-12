import { Component, Input } from '@angular/core';
interface Media {
  name: string;
  type: string;
  duration?: string;
}
@Component({
  selector: 'app-media-viewer',
  templateUrl: './media-viewer.component.html',
  styleUrl: './media-viewer.component.css'
})
export class MediaViewerComponent {
  @Input() selectedMedia: Media | null = null;
}
