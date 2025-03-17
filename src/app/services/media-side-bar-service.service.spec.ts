import { TestBed } from '@angular/core/testing';

import { MediaSideBarServiceService } from './media-side-bar-service.service';

describe('MediaSideBarServiceService', () => {
  let service: MediaSideBarServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MediaSideBarServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
