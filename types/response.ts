declare interface ResponseData<T = any> {
  error: boolean;
  message: string;
  data: T;
}
