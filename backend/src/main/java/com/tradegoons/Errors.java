package com.tradegoons;

import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class Errors {
  @ExceptionHandler(ApiException.class)
  ResponseEntity<?> api(ApiException e) {
    return ResponseEntity.status(e.status).body(Map.of("code", e.code, "error", e.getMessage()));
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  ResponseEntity<?> json() {
    return api(new ApiException(400, "INVALID_JSON", "Invalid JSON."));
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<?> constraint() {
    return api(new ApiException(409, "CONFLICT", "Database constraint rejected the request."));
  }

  @ExceptionHandler(org.springframework.dao.DataAccessResourceFailureException.class)
  ResponseEntity<?> unavailable() {
    return api(new ApiException(503, "UNAVAILABLE", "Trade service unavailable."));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<?> other(Exception e) {
    return api(new ApiException(500, "INTERNAL", "Request could not be completed."));
  }
}
