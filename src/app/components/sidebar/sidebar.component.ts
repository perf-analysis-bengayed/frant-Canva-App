import { Component, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { MediaSidebarService } from '../../services/media-side-bar-service.service';
import { Media } from '../../models/Media';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnDestroy {
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
      try {
        const newMedia = await this.mpediaSidebarService.processFile(file);
        this.mediaItems.push(newMedia);
        this.mediaItems = this.mpediaSidebarService.updateMediaTimes(this.mediaItems);
        this.mediaItemsChange.emit(this.mediaItems);
      } catch (error) {
        console.error('Error processing file:', error);
        // Optionally, use a notification service to inform the user
        // this.notificationService.showError('Unsupported file type');
        alert('Unsupported file type. Please upload a valid video or image.');
      }
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

  removeMedia(index: number) {
    const media = this.mediaItems[index];
    if (media.source) {
      URL.revokeObjectURL(media.source);
    }
    if (media.thumbnail && media.type.startsWith('image')) {
      URL.revokeObjectURL(media.thumbnail);
    }
    this.mediaItems.splice(index, 1);
    this.mediaItems = this.mpediaSidebarService.updateMediaTimes(this.mediaItems);
    this.mediaItemsChange.emit(this.mediaItems);
  }

  ngOnDestroy() {
    this.mediaItems.forEach(media => {
      if (media.source) {
        URL.revokeObjectURL(media.source);
      }
      if (media.thumbnail && media.type.startsWith('image')) {
        URL.revokeObjectURL(media.thumbnail);
      }
    });
  }
}