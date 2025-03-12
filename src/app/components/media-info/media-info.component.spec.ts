import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaInfoComponent } from './media-info.component';

describe('MediaInfoComponent', () => {
  let component: MediaInfoComponent;
  let fixture: ComponentFixture<MediaInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MediaInfoComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MediaInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
