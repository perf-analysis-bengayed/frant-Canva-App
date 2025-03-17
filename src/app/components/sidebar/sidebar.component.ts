// sidebar.component.ts
import { Component, Output, EventEmitter } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Media, MediaSidebarService } from '../../services/media-side-bar-service.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Output() mediaSelected = new EventEmitter<Media>();
  @Output() mediaItemsChange = new EventEmitter<Media[]>();

  mediaItems: Media[] = [];
  selectedMedia: Media | null = null;

  constructor(private mpediaSidebarService: MediaSidebarService) {}

  selectMedia(media: Media) {
    this.selectedMedia = media;
    this.mediaSelected.emit(media);
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const newMedia = await this.mpediaSidebarService.processFile(file);
      this.mediaItems.push(newMedia);
      this.mediaItems = this.mpediaSidebarService.updateMediaTimes(this.mediaItems);
      this.mediaItemsChange.emit(this.mediaItems);
    }
  }

  onDrop(event: CdkDragDrop<Media[]>) {
    this.mediaItems = this.mpediaSidebarService.reorderMediaItems(
      this.mediaItems,
      event.previousIndex,
      event.currentIndex
    );
    this.mediaItemsChange.emit(this.mediaItems);
  }

  onDurationChange() {
    this.mediaItems = this.mpediaSidebarService.updateMediaTimes(this.mediaItems);
    this.mediaItemsChange.emit(this.mediaItems);
  }

  onTimeChange() {
    this.mediaItems = this.mpediaSidebarService.updateMediaTimes(this.mediaItems);
    this.mediaItemsChange.emit(this.mediaItems);
  }
}